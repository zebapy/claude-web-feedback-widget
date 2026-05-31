import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Feedback, FeedbackInput, PageContext } from "../shared/protocol.js";

export interface ClientPresence {
  clientId: string;
  page: PageContext;
  lastSeen: string;
}

export interface ConnectionStatus {
  connected: boolean;
  clientCount: number;
  clients: ClientPresence[];
}

export interface Store {
  addFeedback: (input: FeedbackInput) => Promise<Feedback>;
  takePending: () => Promise<Feedback[]>;
  clearPending: () => Promise<number>;
  waitForFeedback: (timeoutMs: number) => Promise<Feedback[]>;
  startWatching: () => Promise<void>;
  markClientSeen: (clientId: string, page: PageContext) => void;
  removeClient: (clientId: string) => void;
  getStatus: () => ConnectionStatus;
  feedbackDir: string;
}

export interface StoreOptions {
  feedbackDir: string;
}

// The file mirror is the source of truth for pending feedback, not an in-memory
// queue. This lets any process read comments written by whichever process owns
// the receiver port — so a second Claude session degrades gracefully instead of
// crashing, and the CLI/MCP path matches the dispatch script.
export function createStore(options: StoreOptions): Store {
  const { feedbackDir } = options;
  const screenshotDir = join(feedbackDir, "screenshots");

  const seen = new Set<string>();
  const clients = new Map<string, ClientPresence>();
  const waiters: Array<(items: Feedback[]) => void> = [];
  let watcher: FSWatcher | null = null;

  // Serialise pending reads so concurrent scans never hand the same comment to
  // two callers (each marks ids seen as it consumes them).
  let lock: Promise<unknown> = Promise.resolve();
  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = lock.then(task, task);
    lock = run.then(noop, noop);
    return run;
  }

  async function readAll(): Promise<Feedback[]> {
    const names = await readdir(feedbackDir).catch(() => [] as string[]);
    const jsonNames = names.filter((name) => name.endsWith(".json") && !name.startsWith(".")).sort();
    const items: Feedback[] = [];
    for (const name of jsonNames) {
      const raw = await readFile(join(feedbackDir, name), "utf8").catch(() => null);
      if (raw) items.push(JSON.parse(raw) as Feedback);
    }
    return items;
  }

  function consumeUnseen(): Promise<Feedback[]> {
    return serialize(async () => {
      const fresh = (await readAll()).filter((item) => !seen.has(item.id));
      for (const item of fresh) seen.add(item.id);
      return fresh;
    });
  }

  async function addFeedback(input: FeedbackInput): Promise<Feedback> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const screenshotPath = await persistScreenshot(id, input.screenshot);

    const { screenshot: _ignored, ...rest } = input;
    const feedback: Feedback = { ...rest, id, createdAt, screenshotPath };

    await writeFeedbackFile(feedback);
    notifyWaiters();
    return feedback;
  }

  async function persistScreenshot(id: string, dataUrl: string | undefined): Promise<string | undefined> {
    if (!dataUrl) return undefined;
    const buffer = decodePngDataUrl(dataUrl);
    if (!buffer) return undefined;
    await mkdir(screenshotDir, { recursive: true });
    const path = join(screenshotDir, `${id}.png`);
    await writeFile(path, buffer);
    return path;
  }

  async function writeFeedbackFile(feedback: Feedback): Promise<void> {
    await mkdir(feedbackDir, { recursive: true });
    const safeTime = feedback.createdAt.replace(/[:.]/g, "-");
    const path = join(feedbackDir, `${safeTime}-${feedback.id}.json`);
    await writeFile(path, `${JSON.stringify(feedback, null, 2)}\n`);
  }

  function notifyWaiters(): void {
    if (waiters.length === 0) return;
    consumeUnseen().then((items) => {
      if (items.length === 0) return;
      const pendingWaiters = waiters.splice(0, waiters.length);
      for (const resolve of pendingWaiters) resolve(items);
    });
  }

  function waitForFeedback(timeoutMs: number): Promise<Feedback[]> {
    return consumeUnseen().then((immediate) => {
      if (immediate.length > 0) return immediate;
      return new Promise<Feedback[]>((resolve) => {
        const timer = setTimeout(() => {
          const index = waiters.indexOf(deliver);
          if (index >= 0) waiters.splice(index, 1);
          resolve([]);
        }, timeoutMs);

        function deliver(items: Feedback[]): void {
          clearTimeout(timer);
          resolve(items);
        }
        waiters.push(deliver);
      });
    });
  }

  // Mark every existing comment seen at startup, then watch the dir so new files
  // (written by this process or another session's receiver) wake any waiters.
  async function startWatching(): Promise<void> {
    await mkdir(feedbackDir, { recursive: true }).catch(noop);
    await serialize(async () => {
      for (const item of await readAll()) seen.add(item.id);
    });
    watcher = watch(feedbackDir, () => notifyWaiters());
    watcher.on("error", noop);
  }

  return {
    addFeedback,
    takePending: consumeUnseen,
    clearPending: () => consumeUnseen().then((items) => items.length),
    waitForFeedback,
    startWatching,
    markClientSeen(clientId: string, page: PageContext): void {
      clients.set(clientId, { clientId, page, lastSeen: new Date().toISOString() });
    },
    removeClient(clientId: string): void {
      clients.delete(clientId);
    },
    getStatus(): ConnectionStatus {
      const list = Array.from(clients.values());
      return { connected: list.length > 0, clientCount: list.length, clients: list };
    },
    feedbackDir
  };
}

function noop(): void {}

function decodePngDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  const base64 = match?.[1];
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

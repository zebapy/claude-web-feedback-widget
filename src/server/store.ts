import { mkdir, writeFile } from "node:fs/promises";
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
  takePending: () => Feedback[];
  peekPending: () => Feedback[];
  clearPending: () => number;
  waitForFeedback: (timeoutMs: number) => Promise<Feedback[]>;
  markClientSeen: (clientId: string, page: PageContext) => void;
  removeClient: (clientId: string) => void;
  getStatus: () => ConnectionStatus;
  feedbackDir: string;
}

export interface StoreOptions {
  feedbackDir: string;
}

export function createStore(options: StoreOptions): Store {
  const { feedbackDir } = options;
  const screenshotDir = join(feedbackDir, "screenshots");

  const pending: Feedback[] = [];
  const clients = new Map<string, ClientPresence>();
  const waiters: Array<(items: Feedback[]) => void> = [];

  async function addFeedback(input: FeedbackInput): Promise<Feedback> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const screenshotPath = await persistScreenshot(id, input.screenshot);

    const { screenshot: _ignored, ...rest } = input;
    const feedback: Feedback = { ...rest, id, createdAt, screenshotPath };

    pending.push(feedback);
    await writeFeedbackFile(feedback);
    flushWaiters();
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

  function flushWaiters(): void {
    if (waiters.length === 0 || pending.length === 0) return;
    const items = takePending();
    const pendingWaiters = waiters.splice(0, waiters.length);
    for (const resolve of pendingWaiters) resolve(items);
  }

  function takePending(): Feedback[] {
    return pending.splice(0, pending.length);
  }

  function waitForFeedback(timeoutMs: number): Promise<Feedback[]> {
    if (pending.length > 0) return Promise.resolve(takePending());
    return new Promise((resolve) => {
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
  }

  return {
    addFeedback,
    takePending,
    peekPending: () => pending.slice(),
    clearPending: () => takePending().length,
    waitForFeedback,
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

function decodePngDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  const base64 = match?.[1];
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

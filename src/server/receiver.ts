import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, PageContext, ServerMessage } from "../shared/protocol.js";
import { PROTOCOL_VERSION } from "../shared/protocol.js";
import type { Store } from "./store.js";

export interface ReceiverOptions {
  store: Store;
  host: string;
  port: number;
  log: (message: string) => void;
}

export interface Receiver {
  url: string;
  bound: boolean;
  close: () => Promise<void>;
}

const widgetBundlePath = join(dirname(fileURLToPath(import.meta.url)), "widget.global.js");

export async function startReceiver(options: ReceiverOptions): Promise<Receiver> {
  const { store, host, port, log } = options;
  const widgetSource = await readFile(widgetBundlePath, "utf8").catch(
    () => "/* widget bundle missing — run pnpm build */"
  );

  const server = createServer((request, response) => handleHttp(request, response, store, widgetSource));
  const sockets = new WebSocketServer({ server });
  sockets.on("connection", (socket, request) => handleConnection(socket, request, store, log));

  const url = `http://${host}:${port}`;

  // A failed bind must NOT kill the process: another Claude session may already
  // own the port. `ws` re-emits the http server's listen error on the
  // WebSocketServer, so both need a handler or the 'error' event goes unhandled.
  const bound = await bindServer({ server, sockets, host, port, url, log });

  if (!bound) {
    sockets.close();
    server.close();
  }

  return {
    url,
    bound,
    close: () =>
      new Promise<void>((resolve) => {
        sockets.close();
        server.close(() => resolve());
      })
  };
}

function bindServer(args: {
  server: ReturnType<typeof createServer>;
  sockets: WebSocketServer;
  host: string;
  port: number;
  url: string;
  log: (message: string) => void;
}): Promise<boolean> {
  const { server, sockets, host, port, url, log } = args;
  return new Promise((resolve) => {
    let settled = false;

    function onError(error: unknown): void {
      if (settled) return;
      settled = true;
      log(
        `could not bind ${host}:${port} (${describeListenError(error)}). ` +
          `Another session likely owns the receiver; reading feedback from the file mirror instead.`
      );
      resolve(false);
    }

    server.once("error", onError);
    sockets.once("error", onError);
    server.listen(port, host, () => {
      if (settled) return;
      settled = true;
      server.off("error", onError);
      sockets.off("error", onError);
      log(`receiver listening on ${url}`);
      resolve(true);
    });
  });
}

function describeListenError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EADDRINUSE") return "address in use";
  return error instanceof Error ? error.message : String(error);
}

function handleHttp(
  request: IncomingMessage,
  response: ServerResponse,
  store: Store,
  widgetSource: string
): void {
  response.setHeader("Access-Control-Allow-Origin", "*");

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const path = (request.url ?? "/").split("?")[0];

  if (path === "/widget.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }).end(widgetSource);
    return;
  }

  if (path === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(store.getStatus()));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
}

function handleConnection(socket: WebSocket, request: IncomingMessage, store: Store, log: (m: string) => void): void {
  if (!isLocalOrigin(request.headers.origin)) {
    socket.close(1008, "Loopback origins only");
    return;
  }

  let clientId = "";
  let page: PageContext | null = null;
  send(socket, { type: "welcome", protocolVersion: PROTOCOL_VERSION });

  // Both ends are ours, so messages are well-formed; parse directly.
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString()) as ClientMessage;

    if (message.type === "hello") {
      clientId = message.clientId;
      page = message.page;
      store.markClientSeen(clientId, page);
      log(`widget connected: ${page.url}`);
      return;
    }

    if (message.type === "feedback") {
      store
        .addFeedback(message.payload)
        .then((feedback) => {
          send(socket, { type: "ack", id: feedback.id });
          log(`feedback (${feedback.kind}): ${feedback.comment.slice(0, 80)}`);
        })
        .catch((error: unknown) => log(`failed to store feedback: ${String(error)}`));
      return;
    }

    if (message.type === "ping") {
      if (clientId && page) store.markClientSeen(clientId, page);
      send(socket, { type: "pong" });
    }
  });

  socket.on("close", () => {
    if (clientId) store.removeClient(clientId);
  });
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (!URL.canParse(origin)) return false;
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

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
  close: () => Promise<void>;
}

const widgetBundlePath = join(dirname(fileURLToPath(import.meta.url)), "widget.global.js");

export async function startReceiver(options: ReceiverOptions): Promise<Receiver> {
  const { store, host, port, log } = options;
  const widgetSource = await readFile(widgetBundlePath, "utf8");

  const server = createServer((request, response) => handleHttp(request, response, store, widgetSource));
  const sockets = new WebSocketServer({ server });
  sockets.on("connection", (socket, request) => handleConnection(socket, request, store, log));

  await listen(server, host, port);
  const url = `http://${host}:${port}`;
  log(`receiver listening on ${url}`);

  return {
    url,
    close: () =>
      new Promise<void>((resolve) => {
        sockets.close();
        server.close(() => resolve());
      })
  };
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

function listen(server: ReturnType<typeof createServer>, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

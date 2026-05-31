import type { ClientMessage, FeedbackInput, ServerMessage } from "../shared/protocol.js";
import { DEFAULT_HOST, DEFAULT_PORT } from "../shared/protocol.js";
import { buildPageContext } from "./page-context.js";

const RECONNECT_DELAY_MS = 2000;
const HEARTBEAT_MS = 25000;

export interface TransportOptions {
  host?: string;
  port?: number;
  onStatusChange?: (connected: boolean) => void;
  onAck?: (id: string) => void;
}

export interface Transport {
  connect: () => void;
  disconnect: () => void;
  send: (payload: FeedbackInput) => void;
  isConnected: () => boolean;
}

export function createTransport(options: TransportOptions = {}): Transport {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const url = `ws://${host}:${port}`;
  const clientId = readClientId();

  let socket: WebSocket | null = null;
  let connected = false;
  let running = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  function setConnected(value: boolean): void {
    if (connected === value) return;
    connected = value;
    options.onStatusChange?.(value);
  }

  function open(): void {
    socket = new WebSocket(url);
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("message", handleMessage);
  }

  function handleOpen(): void {
    setConnected(true);
    post({ type: "hello", clientId, page: buildPageContext() });
    heartbeatTimer = setInterval(() => post({ type: "ping" }), HEARTBEAT_MS);
  }

  function handleClose(): void {
    setConnected(false);
    clearInterval(heartbeatTimer);
    socket = null;
    if (running) reconnectTimer = setTimeout(open, RECONNECT_DELAY_MS);
  }

  // We control the server, so its messages are well-formed; parse directly.
  function handleMessage(event: MessageEvent): void {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    if (message.type === "welcome") setConnected(true);
    if (message.type === "ack") options.onAck?.(message.id);
  }

  function post(message: ClientMessage): void {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  return {
    connect(): void {
      running = true;
      open();
    },
    disconnect(): void {
      running = false;
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      socket?.close();
      socket = null;
      setConnected(false);
    },
    send(payload: FeedbackInput): void {
      post({ type: "feedback", payload });
    },
    isConnected(): boolean {
      return connected;
    }
  };
}

function readClientId(): string {
  const key = "claude-web-feedback-client-id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

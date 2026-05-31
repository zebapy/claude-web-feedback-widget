import type { ConsoleEntry } from "../shared/protocol.js";

// Keep a small ring buffer of recent console errors/warnings and uncaught
// errors, so feedback can ship the surrounding runtime noise to Claude.

const MAX_ENTRIES = 50;
const buffer: ConsoleEntry[] = [];
let installed = false;

export function installConsoleCapture(): void {
  if (installed) return;
  installed = true;

  patchConsole("error");
  patchConsole("warn");
  window.addEventListener("error", (event) => record("error", event.message));
  window.addEventListener("unhandledrejection", (event) => record("error", stringify(event.reason)));
}

export function getRecentConsoleErrors(): ConsoleEntry[] {
  return buffer.slice();
}

function patchConsole(level: "error" | "warn"): void {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]): void => {
    record(level, args.map(stringify).join(" "));
    original(...args);
  };
}

function record(level: "error" | "warn", message: string): void {
  buffer.push({ level, message: message.slice(0, 2000), timestamp: new Date().toISOString() });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

// String() never throws (unlike JSON.stringify on circular refs), so no
// error boundary is needed here.
function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack ?? value.message;
  return String(value);
}

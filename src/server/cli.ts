import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolve } from "node:path";
import { DEFAULT_HOST, DEFAULT_PORT } from "../shared/protocol.js";
import { createMcpServer } from "./mcp.js";
import { startReceiver } from "./receiver.js";
import { createStore } from "./store.js";

interface CliOptions {
  mode: "mcp" | "serve";
  host: string;
  port: number;
  dir: string;
}

main().catch((error: unknown) => {
  process.stderr.write(`[claude-web-feedback] fatal: ${describeError(error)}\n`);
  process.exit(1);
});

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const store = createStore({ feedbackDir: options.dir });

  if (options.mode === "serve") {
    await runServe(store, options);
    return;
  }

  await runMcp(store, options);
}

// Receiver logs to stdout so the user sees connection activity in the terminal.
async function runServe(store: ReturnType<typeof createStore>, options: CliOptions): Promise<void> {
  const log = (message: string): void => {
    process.stdout.write(`[claude-web-feedback] ${message}\n`);
  };
  const receiver = await startReceiver({ store, host: options.host, port: options.port, log });
  process.stdout.write(
    `\nAdd this to your dev page (or import { init } from \"claude-web-feedback-widget/widget\"):\n` +
      `  <script src=\"${receiver.url}/widget.js\"></script>\n\n` +
      `Feedback is mirrored to: ${store.feedbackDir}\n`
  );
}

// stdout is the JSON-RPC channel here, so every log must go to stderr.
async function runMcp(store: ReturnType<typeof createStore>, options: CliOptions): Promise<void> {
  const log = (message: string): void => {
    process.stderr.write(`[claude-web-feedback] ${message}\n`);
  };
  await startReceiver({ store, host: options.host, port: options.port, log });
  const server = createMcpServer(store);
  await server.connect(new StdioServerTransport());
}

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];

  let mode: "mcp" | "serve" = "mcp";
  if (args[0] === "serve" || args[0] === "mcp") mode = args.shift() as "mcp" | "serve";

  const envPort = process.env["CLAUDE_WEB_FEEDBACK_PORT"];
  const envDir = process.env["CLAUDE_WEB_FEEDBACK_DIR"];

  // When launched as a plugin MCP server the cwd is not the user's project, so
  // prefer CLAUDE_PROJECT_DIR (set by Claude Code) for the file mirror location.
  const baseDir = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();

  let host = process.env["CLAUDE_WEB_FEEDBACK_HOST"] ?? DEFAULT_HOST;
  let port = envPort ? Number(envPort) : DEFAULT_PORT;
  let dir = resolve(baseDir, envDir ?? ".claude-feedback");

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value) continue;
    if (flag === "--host") {
      host = value;
      index += 1;
    } else if (flag === "--port") {
      port = Number(value);
      index += 1;
    } else if (flag === "--dir") {
      dir = resolve(baseDir, value);
      index += 1;
    }
  }

  return { mode, host, port, dir };
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      return "the port is already in use — another receiver may be running, or pass --port <n>";
    }
    return error.message;
  }
  return String(error);
}

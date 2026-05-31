import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ElementAnchor, Feedback, TextQuoteAnchor } from "../shared/protocol.js";
import type { Store } from "./store.js";

const DEFAULT_WAIT_SECONDS = 120;
const MAX_WAIT_SECONDS = 600;

export function createMcpServer(store: Store): McpServer {
  const server = new McpServer({ name: "claude-web-feedback-widget", version: "0.1.0" });

  server.registerTool(
    "get_connection_status",
    {
      title: "Get widget connection status",
      description: "Report whether a browser widget is currently connected to the local feedback receiver.",
      inputSchema: {}
    },
    async () => textResult(formatStatus(store))
  );

  server.registerTool(
    "get_pending_feedback",
    {
      title: "Get pending feedback",
      description: "Return and clear all feedback the widget has sent but Claude has not yet read.",
      inputSchema: {}
    },
    async () => textResult(formatFeedback(await store.takePending()))
  );

  server.registerTool(
    "wait_for_feedback",
    {
      title: "Wait for feedback",
      description:
        "Block until the user submits browser feedback, then return it. Use when you want to act on the next comment the user makes on the page.",
      inputSchema: { timeoutSeconds: z.number().int().positive().max(MAX_WAIT_SECONDS).optional() }
    },
    async ({ timeoutSeconds }) => {
      const seconds = timeoutSeconds ?? DEFAULT_WAIT_SECONDS;
      const items = await store.waitForFeedback(seconds * 1000);
      if (items.length === 0) {
        return textResult(`No feedback within ${seconds}s. The widget may be off — check get_connection_status.`);
      }
      return textResult(formatFeedback(items));
    }
  );

  server.registerTool(
    "clear_feedback",
    {
      title: "Clear pending feedback",
      description: "Discard all pending feedback without reading it.",
      inputSchema: {}
    },
    async () => textResult(`Cleared ${await store.clearPending()} pending item(s).`)
  );

  return server;
}

function textResult(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text }] };
}

function formatStatus(store: Store): string {
  const status = store.getStatus();
  if (!status.connected) {
    return "No widget connected. Open the page with the widget script loaded and confirm the receiver is running.";
  }
  const lines = status.clients.map((client) => `- ${client.page.url} (last seen ${client.lastSeen})`);
  return `${status.clientCount} widget client(s) connected:\n${lines.join("\n")}`;
}

function formatFeedback(items: Feedback[]): string {
  if (items.length === 0) return "No pending feedback.";
  return items.map(formatOne).join("\n\n---\n\n");
}

function formatOne(item: Feedback): string {
  const lines: string[] = [`Comment: ${item.comment}`, `Kind: ${item.kind}`, `Page: ${item.page.url}`];

  if (item.element) lines.push(...formatElement(item.element));
  if (item.text) lines.push(...formatText(item.text));

  if (item.consoleErrors.length > 0) {
    lines.push(`Console (${item.consoleErrors.length}):`);
    for (const entry of item.consoleErrors) lines.push(`  [${entry.level}] ${entry.message}`);
  }

  if (item.screenshotPath) lines.push(`Screenshot: ${item.screenshotPath}`);
  lines.push(`Submitted: ${item.createdAt} (id ${item.id})`);
  return lines.join("\n");
}

function formatElement(element: ElementAnchor): string[] {
  const lines: string[] = [];
  if (element.source) {
    const column = element.source.columnNumber ? `:${element.source.columnNumber}` : "";
    lines.push(`Source: ${element.source.fileName}:${element.source.lineNumber}${column}`);
  }
  if (element.componentName) lines.push(`Component: <${element.componentName}>`);
  if (element.componentStack && element.componentStack.length > 0) {
    lines.push(`Component stack: ${element.componentStack.join(" › ")}`);
  }
  if (element.testId) lines.push(`data-testid: ${element.testId}`);
  if (element.cssSelector) lines.push(`Selector: ${element.cssSelector}`);
  if (element.ariaLabel) lines.push(`aria-label: ${element.ariaLabel}`);
  lines.push(`Element: <${element.tagName}> ${element.rect.width}×${element.rect.height} at (${element.rect.x}, ${element.rect.y})`);
  lines.push(`HTML: ${element.outerHtml}`);
  return lines;
}

function formatText(text: TextQuoteAnchor): string[] {
  const context = `${text.prefix ?? ""}⟦${text.exact}⟧${text.suffix ?? ""}`;
  return [`Selected text: ${text.exact}`, `Context: …${context}…`];
}

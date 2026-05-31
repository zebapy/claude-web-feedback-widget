// End-to-end MCP test: spawn the server over stdio, list tools, push feedback
// through the embedded receiver, then read it back via get_pending_feedback.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocket } from "ws";

const PORT = "4799";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/cli.js", "mcp", "--port", PORT, "--dir", ".claude-feedback-mcp"]
});
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const before = await client.callTool({ name: "get_connection_status", arguments: {} });
console.log("STATUS BEFORE:", before.content[0].text);

await pushFeedback();

const pending = await client.callTool({ name: "get_pending_feedback", arguments: {} });
console.log("PENDING:\n" + pending.content[0].text);

await client.close();
process.exit(0);

function pushFeedback() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin: "http://localhost:3000" });
    const page = { url: "http://localhost:3000/x", title: "X", viewportWidth: 800, viewportHeight: 600, devicePixelRatio: 1 };
    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "hello", clientId: "c1", page }));
      socket.send(
        JSON.stringify({
          type: "feedback",
          payload: {
            kind: "text",
            comment: "Typo: should be 'separate'.",
            page,
            text: { exact: "seperate", prefix: "keep them ", suffix: " from the rest" },
            consoleErrors: []
          }
        })
      );
    });
    socket.on("message", (raw) => {
      if (JSON.parse(raw.toString()).type === "ack") {
        socket.close();
        resolve();
      }
    });
    setTimeout(() => reject(new Error("push timeout")), 4000);
  });
}

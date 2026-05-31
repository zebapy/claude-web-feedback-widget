// Dogfood harness: owns port 4747 as a real MCP server (so the browser widget
// connects to it), waits for the connection, then blocks on wait_for_feedback —
// proving a comment submitted in the browser is delivered through the MCP tool.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PORT = process.env.PORT ?? "4747";
const transport = new StdioClientTransport({ command: "node", args: ["dist/cli.js", "mcp", "--port", PORT] });
const client = new Client({ name: "dogfood", version: "0" });
await client.connect(transport);
console.log(`MCP connected; receiver on ${PORT}`);

for (let i = 0; i < 120; i++) {
  const s = await client.callTool({ name: "get_connection_status", arguments: {} });
  const text = s.content?.[0]?.text ?? "";
  if (text.includes("client(s) connected")) {
    console.log(`STATUS: ${text.split("\n")[0]}`);
    break;
  }
  await new Promise((r) => setTimeout(r, 500));
}

console.log("WAITING for feedback (120s)...");
const r = await client.callTool({ name: "wait_for_feedback", arguments: { timeoutSeconds: 120 } });
console.log("=== FEEDBACK RECEIVED VIA MCP ===");
console.log(r.content?.[0]?.text ?? JSON.stringify(r));
await client.close();
process.exit(0);

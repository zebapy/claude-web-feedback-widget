// Simulates the browser widget: connect over WS, say hello, submit feedback.
import { WebSocket } from "ws";

const port = process.argv[2] ?? "4798";
const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin: "http://localhost:3000" });

const page = {
  url: "http://localhost:3000/recipes",
  title: "Recipes",
  viewportWidth: 1280,
  viewportHeight: 800,
  devicePixelRatio: 2
};

socket.on("open", () => {
  socket.send(JSON.stringify({ type: "hello", clientId: "smoke-client-1", page }));
  socket.send(
    JSON.stringify({
      type: "feedback",
      payload: {
        kind: "element",
        comment: "This button should be primary, not ghost.",
        page,
        element: {
          source: { fileName: "/app/recipes/SaveButton.tsx", lineNumber: 42, columnNumber: 6 },
          componentName: "SaveButton",
          componentStack: ["SaveButton", "RecipeForm", "RecipesPage"],
          testId: "save-recipe",
          cssSelector: "main > form > button:nth-of-type(2)",
          tagName: "button",
          outerHtml: "<button data-testid=\"save-recipe\">Save</button>",
          rect: { x: 120, y: 320, width: 80, height: 36 }
        },
        consoleErrors: [{ level: "warn", message: "deprecated prop `color`", timestamp: new Date().toISOString() }]
      }
    })
  );
});

socket.on("message", (raw) => {
  const message = JSON.parse(raw.toString());
  console.log("server:", JSON.stringify(message));
  if (message.type === "ack") {
    socket.close();
    process.exit(0);
  }
});

setTimeout(() => {
  console.error("timeout: no ack");
  process.exit(1);
}, 4000);

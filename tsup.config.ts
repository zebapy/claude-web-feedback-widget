import { defineConfig } from "tsup";

// Three separate bundles: the Node CLI/server, the widget as an ESM import,
// and the widget as a self-contained IIFE that the receiver serves over a
// single <script> tag.
export default defineConfig([
  {
    entry: { cli: "src/server/cli.ts" },
    platform: "node",
    format: ["esm"],
    target: "node20",
    dts: false,
    clean: true,
    // Bundled `ws` uses dynamic require() of node builtins; the createRequire
    // shim makes that resolve in the ESM bundle (esbuild's default require throws).
    banner: {
      js: "#!/usr/bin/env node\nimport { createRequire as __cwfCreateRequire } from 'node:module';\nconst require = __cwfCreateRequire(import.meta.url);"
    },
    // Bundle runtime deps so the CLI is self-contained — a plugin install ships
    // dist/ without node_modules, so nothing can resolve at runtime otherwise.
    noExternal: ["@modelcontextprotocol/sdk", "ws", "zod"]
  },
  {
    entry: { widget: "src/widget/index.ts" },
    platform: "browser",
    format: ["esm"],
    dts: true,
    clean: false,
    // Bundle browser deps so consumers need nothing else.
    noExternal: ["html2canvas-pro"]
  },
  {
    entry: { widget: "src/widget/index.ts" },
    platform: "browser",
    format: ["iife"],
    globalName: "ClaudeWebFeedback",
    dts: false,
    clean: false,
    minify: true,
    noExternal: ["html2canvas-pro"]
  }
]);

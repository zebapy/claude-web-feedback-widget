---
description: Wire the current project to the web-feedback widget (dev script tag + optional file:line source plugin)
---

# Set up the web-feedback widget in this project

Goal: add the browser widget to this project's dev build so the user can comment
on the running app and have comments arrive in Claude Code. Make the smallest
change possible, gate it to development only, and **show every edit as a diff and
confirm before applying**.

## 1. Detect the project type

Inspect the repo before changing anything, and report what you find:

- **Vite** — `vite.config.{ts,js}` and an `index.html` at the root.
- **Next.js** — `next.config.*`, with `app/` or `pages/`.
- **Create React App / Webpack** — `public/index.html`.
- **Plain static site** — a hand-written `index.html`.

## 2. Add the widget script tag (required, minimal)

This plugin's MCP server runs a local receiver that serves the widget at
`http://127.0.0.1:4747/widget.js`. Add it **dev-only**:

- Static / Vite / CRA `index.html` — just before `</body>`:
  ```html
  <script src="http://127.0.0.1:4747/widget.js"></script>
  ```
- Next.js — render only in development (e.g. in `app/layout.tsx`):
  ```tsx
  {process.env.NODE_ENV === "development" && (
    <script src="http://127.0.0.1:4747/widget.js" async />
  )}
  ```

This alone gives component-name + CSS-selector + screenshot anchors.

## 3. Offer the file:line source anchor (recommended)

Ask the user whether they want the `file:line` source anchor (it lets Claude jump
straight to the JSX that rendered the element). It needs a small babel plugin in
the dev build. The plugin ships with this plugin at
`${CLAUDE_PLUGIN_ROOT}/babel-source-location.mjs`.

If they say yes:

1. Copy it into the project so the build imports it with no npm dependency:
   ```bash
   mkdir -p .claude-web-feedback
   cp "${CLAUDE_PLUGIN_ROOT}/babel-source-location.mjs" .claude-web-feedback/babel-source-location.mjs
   ```
   If `$CLAUDE_PLUGIN_ROOT` is unset, read the file from this plugin's directory and
   write the same contents into `.claude-web-feedback/babel-source-location.mjs`.
2. Wire it into the dev build:
   - **Vite** (`@vitejs/plugin-react`):
     ```ts
     import sourceLocation from "./.claude-web-feedback/babel-source-location.mjs";
     // ...
     react({ babel: { plugins: [sourceLocation] } })
     ```
   - **Next.js / Babel** — add the plugin path to the dev Babel `plugins`.
3. Remind the user it is dev-only; do not ship it to production.

## 4. Confirm and summarize

After wiring, tell the user: start the dev server, open the app, click **Comment**
in the widget toolbar (bottom-right), pick an element or select text, and the
comment lands here. They can then run `/web-feedback:dispatch` or just ask you to
"read my feedback".

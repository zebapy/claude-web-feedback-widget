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

## 2. Choose this project's port

The plugin's MCP server runs a local receiver on one port. Each project should use
its **own** port so multiple projects don't fight over it and feedback always lands
in the project you're working in.

- Default is `4747`. If the user already uses the widget in another project, pick a
  distinct free port (e.g. `4748`, `4749`).
- Write it to `<project>/.claude/web-feedback.json` so the plugin's MCP server binds
  the same port for this project (it reads `CLAUDE_PROJECT_DIR/.claude/web-feedback.json`):

  ```json
  { "port": 4748 }
  ```

Use that chosen port in every URL below. If the user is happy with `4747` and only
uses one project, you can skip the config file (4747 is the default).

## 3. Add the widget script tag (required, minimal)

The receiver serves the widget at `http://127.0.0.1:<port>/widget.js`. Add it
**dev-only**, using this project's port:

- Static / Vite / CRA `index.html` — just before `</body>`:
  ```html
  <script src="http://127.0.0.1:4748/widget.js"></script>
  ```
- Next.js — render only in development (e.g. in `app/layout.tsx`):
  ```tsx
  {process.env.NODE_ENV === "development" && (
    <script src="http://127.0.0.1:4748/widget.js" async />
  )}
  ```

The script tag's port and `.claude/web-feedback.json` must match. This alone gives
component-name + CSS-selector + screenshot anchors.

## 4. Offer the file:line source anchor (recommended)

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

## 5. Confirm and summarize

After wiring, tell the user: restart this Claude session (so the plugin's MCP
server picks up the project port), start the dev server, open the app, press
**⌘/Ctrl+Shift+K** (or click **Comment**), pick an element or select text, and the
comment lands in this project's `.claude-feedback/`. They can then run
`/web-feedback:dispatch` (handle here) or `/web-feedback:agents` (one background
agent per comment).

# claude-web-feedback-widget

A dev-only browser widget to point at elements (or select text) on your running
app, leave an inline comment, and have it land in your local Claude Code session
— in your **real** browser, with no IDE-embedded browser and no app code changes
beyond one script tag.

The comment arrives with a **layered source anchor** so Claude can jump straight
to the code:

1. **Source location** — `fileName:lineNumber:column` from a `data-source-loc`
   attribute stamped by the bundled babel plugin (runtime-agnostic; works on React 19)
2. **Component name** + the component stack that rendered the node
3. **`data-testid`**
4. **CSS selector** (stable, structural)
5. **`outerHTML`** snippet, bounding rect, `aria-label`, recent console errors
6. **Text quote** (W3C exact + prefix/suffix) for text selections
7. **Screenshot** (optional, oklch-safe via `html2canvas-pro`)

## How it works

```
 Browser (your app)                     Local machine
 ┌─────────────────┐   WebSocket   ┌──────────────────────────────┐
 │  widget.js      │ ───────────▶  │  receiver (127.0.0.1:4747)   │
 │  (Shadow DOM)   │               │  ├─ in-memory pending queue   │
 └─────────────────┘               │  ├─ .claude-feedback/*.json   │
                                    │  └─ MCP stdio server ◀── Claude Code
                                    └──────────────────────────────┘
```

One process is both the loopback receiver (the browser talks to it) and the MCP
stdio server (Claude Code talks to it), so feedback the browser sends is
immediately available to Claude's MCP tools.

## Install as a Claude Code plugin (recommended)

This repo doubles as a Claude Code plugin: installing it registers the MCP server
(and its loopback receiver) once, for use across all your projects — no
`claude mcp add`, no per-machine config. The bundled CLI is self-contained, so the
plugin needs no `node_modules`.

```bash
# from a local clone (persistent)
/plugin marketplace add /path/to/claude-web-feedback-widget
/plugin install web-feedback@claude-web-feedback

# …or from GitHub
/plugin marketplace add zebapy/claude-web-feedback-widget
/plugin install web-feedback@claude-web-feedback
```

For a quick, session-only try without installing:

```bash
claude --plugin-dir /path/to/claude-web-feedback-widget
```

The plugin ships two slash commands:

- **`/web-feedback:setup`** — run it inside any project; it detects the framework
  and wires the widget (dev script tag + optional `file:line` babel plugin) for you.
- **`/web-feedback:run`** — pick up all pending comments and dispatch one background
  agent per comment.

> The `dist/` build output is committed so the plugin works on install. After
> changing source, run `pnpm build` before committing.

## Install as an npm package

```bash
npm install -D claude-web-feedback-widget   # or pnpm add -D
```

## 1. Add the widget to your dev app

**Option A — script tag (zero bundler coupling).** Render this only in dev:

```html
<script src="http://127.0.0.1:4747/widget.js"></script>
```

The receiver serves the script and the widget auto-connects back to the port it
was served from.

**Option B — import it** (bundler users):

```ts
if (import.meta.env.DEV) {
  const { init } = await import("claude-web-feedback-widget/widget");
  init(); // or init({ host, port })
}
```

### Enable the `file:line` source anchor (recommended)

Add the babel plugin in dev so every JSX element carries a `data-source-loc`
attribute. The widget reads it off the DOM, so the source anchor works on any
React version and JSX runtime (React 19 removed the fiber source the old
`__source` approach relied on).

**Vite** (`@vitejs/plugin-react`):

```ts
import react from "@vitejs/plugin-react";
import sourceLocation from "claude-web-feedback-widget/babel";

export default defineConfig({
  plugins: [react({ babel: { plugins: [sourceLocation] } })]
});
```

**Next.js / Babel:** add `"claude-web-feedback-widget/babel"` to your dev Babel
plugins. Without the plugin you still get component name → selector → outerHTML.

## 2. Register the MCP server with Claude Code

```bash
claude mcp add --scope user web-feedback -- npx claude-web-feedback
```

That single process also starts the loopback receiver, so the browser widget can
connect as soon as Claude Code launches the server.

## 3. Use it

1. Start your app's dev server and open it in your browser.
2. Click **Comment** in the widget toolbar (bottom-right) — or press the hotkey
   **⌘/Ctrl+Shift+K** — then click an element or select text. Type a comment and
   **Send to Claude**. (Screenshots are opt-in: tick the box to include one.)
3. In Claude Code, ask it to read your feedback. It calls `wait_for_feedback`
   (or `get_pending_feedback`) and receives the comment plus the source anchor.

The hotkey is configurable: `init({ hotkey: "mod+shift+k" })` (`mod` = ⌘/Ctrl),
or pass `""` to disable it.

## MCP tools

| Tool | Purpose |
|------|---------|
| `wait_for_feedback` | Block until the next comment arrives (optional `timeoutSeconds`). |
| `get_pending_feedback` | Return and clear everything submitted so far. |
| `get_connection_status` | Report whether a widget is currently connected. |
| `clear_feedback` | Discard pending feedback without reading it. |

Every comment is also mirrored to `.claude-feedback/<timestamp>-<id>.json`
(screenshots to `.claude-feedback/screenshots/`), so Claude can read them as
files too.

### Seeing what you sent

The widget toolbar shows a **Sent (N)** button once you submit a comment. Open it
for a session log of every comment and its delivery state: _Sending → Sent →
Saved ✓_ (the receiver acked and mirrored it).

### Acting on feedback

Run **`/web-feedback:run`** — one command that picks up every pending comment and
dispatches each as its own background agent. Per comment it runs
`claude --bg --name <slug> "<comment + source anchor>"`, so each becomes a row in
[agent view](https://code.claude.com/docs/en/agent-view) (`claude agents`): it works
in an isolated worktree, can open a PR, and you peek/attach/review from one screen.

It refuses to act when nothing is pending (it never invents feedback) and asks before
dispatching more than a few sessions, since each uses quota.

For scripting, `scripts/dispatch-feedback.mjs` turns the mirrored feedback into
agent-ready task blocks and tracks what's handled in `.claude-feedback/.dispatched.json`:

```bash
node scripts/dispatch-feedback.mjs          # list undispatched tasks
node scripts/dispatch-feedback.mjs --json   # machine-readable
node scripts/dispatch-feedback.mjs --mark   # list, then mark dispatched
```

## Configuration

CLI flags and env vars (env takes effect as the default; flags override):

| Flag | Env | Default |
|------|-----|---------|
| `--port` | `CLAUDE_WEB_FEEDBACK_PORT` | `4747` |
| `--host` | `CLAUDE_WEB_FEEDBACK_HOST` | `127.0.0.1` |
| `--dir`  | `CLAUDE_WEB_FEEDBACK_DIR`  | `./.claude-feedback` |

### Per-project port

One receiver owns a port, so to use the widget in **several projects at once**, give
each its own port. The server reads it (when no flag/env is set) from a per-project
file — `/web-feedback:setup` writes this for you:

```jsonc
// <project>/.claude/web-feedback.json
{ "port": 4748 }
```

Point that project's `<script>` tag at the same port
(`http://127.0.0.1:4748/widget.js`). Each project then binds its own port, serves its
own widget, and feedback always lands in that project's `.claude-feedback/`. Port
precedence: `--port` flag > env > this file > `4747`.

Run just the receiver (no MCP, handy for trying it out):

```bash
npx claude-web-feedback serve
```

## Limitations

- **Source anchor needs the babel plugin in dev.** It reads the `data-source-loc`
  attribute the plugin stamps onto JSX. Without it (or in a production build) the
  widget degrades to component name → selector → outerHTML. The plugin is dev-only
  by design — don't ship it to production.
- **Loopback only.** The receiver binds `127.0.0.1` and accepts WebSocket
  connections from localhost origins only. It is unauthenticated by design (a
  local dev tool); do not expose the port.
- **One receiver per port.** Only one Claude session can own port 4747. If you run
  the plugin in a second session, that session can't bind the port — it stays up
  (no crash) and reads feedback from the shared file mirror. The browser connects
  to whichever session owns the port, and its comments mirror to that project's
  `.claude-feedback/`.
- **Clicks are suppressed in pick mode** so the host page doesn't navigate.
  Element pick = click; text pick = drag-select.

## Development

```bash
pnpm install
pnpm build         # builds dist/cli.js, dist/widget.js, dist/widget.global.js
pnpm typecheck
node scripts/static.mjs 8080   # serve examples/demo.html for a manual try
```

## License

MIT

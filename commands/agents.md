---
description: Dispatch each pending browser comment as its own background agent (a row in `claude agents`)
---

# Send web-feedback comments to background agents

Turn each pending comment into its own **background Claude Code session** so it
runs independently and shows up as a row in agent view (`claude agents`). Each
edits in an isolated git worktree and can open its own PR.

## Guardrails (read first)

- Act ONLY on comments a tool or file actually returns. **Never invent, infer, or
  paraphrase a comment.**
- **If zero feedback is pending, STOP.** Dispatch nothing, edit nothing, report that.
- Background sessions each consume subscription quota. If more than 3 comments are
  pending, tell the user how many you'll dispatch and **ask to proceed first**.

## 1. Get the feedback

Call `get_pending_feedback` from the `web-feedback` MCP server (it returns and
clears all pending comments). If that tool is unavailable, read the file mirror:
`./.claude-feedback/*.json`. If nothing comes back, stop per the guardrails.

## 2. Dispatch one background agent per comment

For each real comment, run one shell command:

```bash
claude --bg --name "<short-slug>" "<task>"
```

- `<short-slug>` — a few words from the comment, e.g. `upgrade-btn-color`.
- `<task>` — the verbatim comment plus its source anchor and a safety clause, e.g.:

  > Address this browser feedback. Comment: "<verbatim comment>". Source: <file:line>.
  > Component: <name>. Selector: <css>. Verify the target file/element exists before
  > editing; if the anchor does not resolve, stop and report instead of guessing.

  Use the best-first anchor (`Source: file:line` → component → component stack →
  `data-testid` → CSS selector → `outerHTML`). Quote the comment verbatim.

Each `claude --bg` prints a short session id (e.g. `backgrounded · 7c5dcf5d · <name>`).

## 3. Report

List each comment, the file/line it mapped to, and the background session id you
started. Tell the user to run **`claude agents`** to watch the rows, peek/reply,
attach, and review each session's PR or worktree. Useful follow-ups:
`claude logs <id>`, `claude attach <id>`, `claude stop <id>`.

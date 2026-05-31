---
description: Pick up all pending browser feedback and run one background agent per comment
---

# Run agents on web feedback

One shot: pull every pending comment from the widget and dispatch each as its own
background Claude Code session (a row in `claude agents`). Each works in an isolated
git worktree and can open a PR.

## Guardrails (read first)

- Act ONLY on comments a tool or file actually returns. **Never invent, infer, or
  paraphrase a comment.**
- **If zero feedback is pending, STOP.** Dispatch nothing, edit nothing — just report
  that there's nothing pending (and the likely reason) and end.
- Background sessions each use subscription quota. If more than 3 comments are
  pending, tell the user how many you'll dispatch and **ask before proceeding**.

## 1. Pick up the feedback

Call `get_pending_feedback` from the `web-feedback` MCP server (it returns and clears
all pending comments). If the user said they're about to comment, use
`wait_for_feedback` instead. If the MCP tools are unavailable ("No such tool
available"), the server isn't connected — say so, and fall back to reading the file
mirror: `./.claude-feedback/*.json`. If nothing comes back, stop per the guardrails.

## 2. Run one background agent per comment

For each real comment, run one shell command:

```bash
claude --bg --name "<short-slug>" "<task>"
```

- `<short-slug>` — a few words from the comment, e.g. `upgrade-btn-color`.
- `<task>` — the verbatim comment plus its source anchor and a safety clause:

  > Address this browser feedback. Comment: "<verbatim comment>". Source: <file:line>.
  > Component: <name>. Selector: <css>. Verify the target file/element exists before
  > editing; if the anchor does not resolve, stop and report instead of guessing.

  Use the best-first anchor (`Source: file:line` → component → component stack →
  `data-testid` → CSS selector → `outerHTML`). Quote the comment verbatim.

Each `claude --bg` prints a short session id. The agents run in the current project,
so their edits and PRs land where you invoked this command.

## 3. Report

List each comment, the file/line it mapped to, and the background session id you
started. Tell the user to run **`claude agents`** to watch the rows, peek/reply,
attach, and review each PR (`claude logs <id>`, `claude attach <id>`).

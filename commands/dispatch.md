---
description: Read pending browser feedback and act on it, or fan it out to background agents
---

# Handle web-feedback comments

The user has submitted comments from the browser widget. Pull them and act.

## 1. Get the feedback

Prefer the MCP tools from the `web-feedback` server:

- `get_pending_feedback` — return and clear everything submitted so far.
- `wait_for_feedback` — block for the next comment (use if the user says they are
  about to comment).
- `get_connection_status` — check a widget is connected if nothing arrives.

If the MCP tools are unavailable, read the file mirror instead: the JSON files in
`./.claude-feedback/` (screenshots in `./.claude-feedback/screenshots/`).

## 2. Act

For each comment:

- Locate the code using the source anchor, best-first: `Source: file:line` →
  `Component` → component stack → `data-testid` → CSS selector → `outerHTML`.
- The `Comment` text is the user's request for that element or text selection.

If there are several independent comments, fan them out — spawn one background
subagent per comment, each given the comment plus its source anchor — then report
what each is doing. For a single comment, just do the work.

## 3. Summarize

List each comment, the file/line it mapped to, and what you changed or dispatched.

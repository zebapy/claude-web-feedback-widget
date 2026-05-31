---
description: Read pending browser feedback and act on it, or fan it out to background agents
---

# Handle web-feedback comments

Act ONLY on comments that a tool or file actually returns. This is the hard rule.

> This command handles feedback **in the current session** (doing the work here, or
> fanning out to in-session subagents). To instead send each comment to its own
> **background agent** that appears as a row in `claude agents`, use
> `/web-feedback:agents`.

## Absolute guardrails (read first)

- **Never invent, infer, guess, or paraphrase a comment.** The only valid feedback
  is the literal text returned by `get_pending_feedback` / `wait_for_feedback`, or
  read verbatim from a `.claude-feedback/*.json` file.
- **If zero feedback is returned, STOP.** Do not edit, create, or open any files.
  Report "no pending feedback" and the likely reason, then end. Do not improvise a
  task to work on.
- Before editing anything, quote the exact comment you are acting on so it is clear
  the input was real.

## 1. Get the feedback

Try the MCP tools from the `web-feedback` server first:

- `get_connection_status` — confirm the server is reachable and whether a widget is connected.
- `get_pending_feedback` — return and clear everything submitted so far.
- `wait_for_feedback` — block for the next comment (only if the user says they are about to comment).

If those tools are **not available** (e.g. "No such tool available"), the MCP
server is not connected — say so and stop, or read the file mirror if it exists:
the JSON files in `./.claude-feedback/` (screenshots in `./.claude-feedback/screenshots/`).
If neither source yields a comment, STOP per the guardrails above.

Common reason for nothing arriving: the receiver could not bind its port (another
Claude session owns it), or no widget is connected. Surface that instead of acting.

## 2. Act (only on real comments)

For each comment actually returned:

- Locate the code from its source anchor, best-first: `Source: file:line` →
  `Component` → component stack → `data-testid` → CSS selector → `outerHTML`.
- **Verify the target exists** (read the file / grep the selector) before editing.
  If the anchor does not resolve to a real file, report that — do not guess a
  different file.
- The `Comment` text is the user's request for that element or selection.

If several independent comments come back, fan them out — one background subagent
per comment, each given the verbatim comment plus its source anchor. For a single
comment, just do the work.

## 3. Summarize

List each real comment, the file/line it mapped to, and what you changed or
dispatched. If nothing was pending, say exactly that and stop.

// Turn mirrored feedback into agent-ready task blocks.
//
// Claude reads this output and spawns one background subagent per block. Already
// dispatched ids are tracked in `<dir>/.dispatched.json` so reruns only surface
// new comments.
//
//   node scripts/dispatch-feedback.mjs            # list undispatched tasks
//   node scripts/dispatch-feedback.mjs --json      # same, as JSON
//   node scripts/dispatch-feedback.mjs --mark       # list, then mark dispatched
//   node scripts/dispatch-feedback.mjs --all        # include already-dispatched
//
// Flow: ask Claude to "dispatch my feedback". It runs this with --json, spawns a
// background Agent per task, then runs it again with --mark to record them.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = readDir();
const flags = new Set(process.argv.slice(2));
const dispatchedPath = join(dir, ".dispatched.json");

const dispatched = await readDispatched();
const items = await readFeedback();
const fresh = flags.has("--all") ? items : items.filter((item) => !dispatched.includes(item.id));

if (flags.has("--json")) {
  process.stdout.write(`${JSON.stringify(fresh.map(toTask), null, 2)}\n`);
} else {
  printHuman(fresh);
}

if (flags.has("--mark") && fresh.length > 0) {
  const next = Array.from(new Set([...dispatched, ...fresh.map((item) => item.id)]));
  await writeFile(dispatchedPath, `${JSON.stringify(next, null, 2)}\n`);
  process.stderr.write(`Marked ${fresh.length} item(s) dispatched.\n`);
}

function readDir() {
  const fromFlag = process.argv.indexOf("--dir");
  if (fromFlag >= 0 && process.argv[fromFlag + 1]) return process.argv[fromFlag + 1];
  return process.env.CLAUDE_WEB_FEEDBACK_DIR ?? "./.claude-feedback";
}

async function readDispatched() {
  const raw = await readFile(dispatchedPath, "utf8").catch(() => null);
  if (!raw) return [];
  return JSON.parse(raw);
}

async function readFeedback() {
  const names = await readdir(dir).catch(() => []);
  const jsonNames = names.filter((name) => name.endsWith(".json") && name !== ".dispatched.json").sort();
  const parsed = [];
  for (const name of jsonNames) {
    const raw = await readFile(join(dir, name), "utf8");
    parsed.push(JSON.parse(raw));
  }
  return parsed;
}

function toTask(item) {
  return { id: item.id, page: item.page?.url, anchor: anchorLine(item), task: formatTask(item) };
}

function anchorLine(item) {
  const element = item.element;
  if (element?.source) {
    const column = element.source.columnNumber ? `:${element.source.columnNumber}` : "";
    return `${element.source.fileName}:${element.source.lineNumber}${column}`;
  }
  if (element?.componentName) return `<${element.componentName}>`;
  if (element?.cssSelector) return element.cssSelector;
  if (item.text?.exact) return `text: "${item.text.exact}"`;
  return item.page?.url ?? "unknown";
}

function formatTask(item) {
  const lines = [`Comment: ${item.comment}`, `Page: ${item.page?.url ?? "?"}`];
  const element = item.element;

  if (element?.source) {
    const column = element.source.columnNumber ? `:${element.source.columnNumber}` : "";
    lines.push(`Source: ${element.source.fileName}:${element.source.lineNumber}${column}`);
  }
  if (element?.componentName) lines.push(`Component: <${element.componentName}>`);
  if (element?.componentStack?.length) lines.push(`Component stack: ${element.componentStack.join(" › ")}`);
  if (element?.testId) lines.push(`data-testid: ${element.testId}`);
  if (element?.cssSelector) lines.push(`Selector: ${element.cssSelector}`);
  if (element?.outerHtml) lines.push(`HTML: ${element.outerHtml}`);
  if (item.text?.exact) {
    const context = `${item.text.prefix ?? ""}⟦${item.text.exact}⟧${item.text.suffix ?? ""}`;
    lines.push(`Selected text: ${item.text.exact}`, `Context: …${context}…`);
  }
  if (item.consoleErrors?.length) {
    lines.push(`Console (${item.consoleErrors.length}):`);
    for (const entry of item.consoleErrors) lines.push(`  [${entry.level}] ${entry.message}`);
  }
  if (item.screenshotPath) lines.push(`Screenshot: ${item.screenshotPath}`);
  return lines.join("\n");
}

function printHuman(tasks) {
  if (tasks.length === 0) {
    process.stdout.write("No undispatched feedback.\n");
    return;
  }
  process.stdout.write(`${tasks.length} task(s) ready to dispatch:\n\n`);
  tasks.forEach((item, index) => {
    process.stdout.write(`=== task ${index + 1} (id ${item.id}) ===\n${formatTask(item)}\n\n`);
  });
}

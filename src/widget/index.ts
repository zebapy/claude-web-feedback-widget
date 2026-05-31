import type { DomRectLike, FeedbackInput } from "../shared/protocol.js";
import { DEFAULT_PORT } from "../shared/protocol.js";
import { buildElementAnchor } from "./anchor/element.js";
import { getReactAnchor } from "./anchor/react-source.js";
import { buildTextQuoteAnchor } from "./anchor/text-quote.js";
import { getRecentConsoleErrors, installConsoleCapture } from "./console-capture.js";
import { createInspector } from "./inspector.js";
import { buildPageContext } from "./page-context.js";
import { captureScreenshot } from "./screenshot.js";
import { createTransport } from "./transport.js";
import { createActivity } from "./ui/activity.js";
import type { CommentForm } from "./ui/comment-form.js";
import { showCommentForm } from "./ui/comment-form.js";
import { createHost } from "./ui/host.js";
import type { Hint } from "./ui/notices.js";
import { showHint, showToast } from "./ui/notices.js";
import { createToolbar } from "./ui/toolbar.js";

export interface WidgetOptions {
  host?: string;
  port?: number;
  // Keyboard shortcut to start/cancel a comment, e.g. "mod+shift+k" (mod = ⌘/Ctrl).
  // Pass an empty string to disable. Defaults to "mod+shift+k".
  hotkey?: string;
}

export interface WidgetHandle {
  destroy: () => void;
}

let activeHandle: WidgetHandle | null = null;

export function init(options: WidgetOptions = {}): WidgetHandle {
  if (activeHandle) return activeHandle;

  installConsoleCapture();
  const host = createHost();

  let inspecting = false;
  let openForm: CommentForm | null = null;
  let hint: Hint | null = null;
  // Entry ids sent and awaiting the receiver's ack, in send order (acks are FIFO).
  const awaitingAck: string[] = [];

  function describe(element: Element): string {
    const react = getReactAnchor(element);
    if (react.componentName) return `<${react.componentName}>`;
    if (react.source) return `${basename(react.source.fileName)}:${react.source.lineNumber}`;
    return element.tagName.toLowerCase();
  }

  function toggleInspect(): void {
    if (inspecting) {
      exitInspect();
      return;
    }
    enterInspect();
  }

  function enterInspect(): void {
    closeForm();
    inspecting = true;
    toolbar.setInspecting(true);
    hint = showHint(host.root, "Click an element or select text to comment · Esc to cancel");
    inspector.start();
  }

  function exitInspect(): void {
    inspecting = false;
    toolbar.setInspecting(false);
    hint?.destroy();
    hint = null;
    inspector.stop();
  }

  function onPickElement(element: Element): void {
    exitInspect();
    const anchor = buildElementAnchor(element);
    presentForm({
      title: describe(element),
      anchorRect: anchor.rect,
      screenshotTarget: element,
      makeInput: (comment) => ({ ...baseInput(), kind: "element", comment, element: anchor })
    });
  }

  function onPickText(range: Range): void {
    exitInspect();
    const text = buildTextQuoteAnchor(range);
    const target = nearestElement(range.commonAncestorContainer);
    presentForm({
      title: `“${truncate(text.exact, 48)}”`,
      anchorRect: toRectLike(range.getBoundingClientRect()),
      screenshotTarget: target,
      makeInput: (comment) => ({ ...baseInput(), kind: "text", comment, text })
    });
  }

  function presentForm(args: {
    title: string;
    anchorRect: DomRectLike;
    screenshotTarget: Element;
    makeInput: (comment: string) => FeedbackInput;
  }): void {
    closeForm();
    openForm = showCommentForm({
      root: host.root,
      title: args.title,
      anchorRect: args.anchorRect,
      screenshotAvailable: true,
      onCancel: closeForm,
      onSubmit: ({ comment, includeScreenshot }) => {
        closeForm();
        const entryId = activity.add({ title: args.title, comment });
        submit(args.makeInput(comment), includeScreenshot ? args.screenshotTarget : null, entryId);
      }
    });
  }

  function submit(input: FeedbackInput, screenshotTarget: Element | null, entryId: string): void {
    if (!screenshotTarget) {
      deliver(input, entryId);
      return;
    }
    captureScreenshot(screenshotTarget)
      .then((screenshot) => deliver({ ...input, screenshot }, entryId))
      .catch(() => {
        showToast(host.root, "Screenshot failed — sent comment without it", "error");
        deliver(input, entryId);
      });
  }

  function deliver(input: FeedbackInput, entryId: string): void {
    if (!transport.isConnected()) {
      activity.setStatus(entryId, "failed");
      showToast(host.root, "Receiver offline — run: npx claude-web-feedback serve", "error");
      return;
    }
    transport.send(input);
    activity.setStatus(entryId, "sent");
    awaitingAck.push(entryId);
    showToast(host.root, "Sent ✓ — ask Claude to read it");
  }

  function baseInput(): Pick<FeedbackInput, "page" | "consoleErrors"> {
    return { page: buildPageContext(), consoleErrors: getRecentConsoleErrors() };
  }

  function closeForm(): void {
    openForm?.destroy();
    openForm = null;
  }

  const transport = createTransport({
    host: options.host,
    port: options.port,
    onStatusChange: (connected) => toolbar.setConnected(connected),
    onAck: () => {
      const entryId = awaitingAck.shift();
      if (entryId) activity.setStatus(entryId, "confirmed");
    }
  });
  const activity = createActivity({
    root: host.root,
    onCountChange: (count) => toolbar.setSentCount(count)
  });
  const hotkey = parseHotkey(options.hotkey ?? "mod+shift+k");
  const toolbar = createToolbar({
    root: host.root,
    onToggleInspect: toggleInspect,
    onToggleActivity: () => activity.toggle(),
    hotkeyLabel: hotkey ? formatHotkey(hotkey) : undefined
  });

  function onHotkey(event: KeyboardEvent): void {
    if (!hotkey || !matchesHotkey(event, hotkey)) return;
    if (isEditable(document.activeElement)) return;
    event.preventDefault();
    event.stopPropagation();
    toggleInspect();
  }
  window.addEventListener("keydown", onHotkey, true);
  const inspector = createInspector({
    root: host.root,
    hostElement: host.hostElement,
    describe,
    onPickElement,
    onPickText,
    onCancel: exitInspect
  });

  transport.connect();

  activeHandle = {
    destroy(): void {
      window.removeEventListener("keydown", onHotkey, true);
      exitInspect();
      closeForm();
      transport.disconnect();
      host.destroy();
      activeHandle = null;
    }
  };
  return activeHandle;
}

interface Hotkey {
  key: string;
  shift: boolean;
  mod: boolean;
}

function parseHotkey(spec: string): Hotkey | null {
  const parts = spec.toLowerCase().split("+").map((part) => part.trim()).filter(Boolean);
  const key = parts.at(-1);
  if (!key) return null;
  const isMod = (part: string): boolean => part === "mod" || part === "cmd" || part === "ctrl" || part === "meta";
  return { key, shift: parts.includes("shift"), mod: parts.some(isMod) };
}

function matchesHotkey(event: KeyboardEvent, hotkey: Hotkey): boolean {
  if (event.key.toLowerCase() !== hotkey.key) return false;
  if (event.shiftKey !== hotkey.shift) return false;
  return (event.metaKey || event.ctrlKey) === hotkey.mod;
}

function formatHotkey(hotkey: Hotkey): string {
  const mac = navigator.userAgent.includes("Mac");
  const parts: string[] = [];
  if (hotkey.mod) parts.push(mac ? "⌘" : "Ctrl");
  if (hotkey.shift) parts.push(mac ? "⇧" : "Shift");
  parts.push(hotkey.key.toUpperCase());
  return parts.join(mac ? "" : "+");
}

function isEditable(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (element as HTMLElement).isContentEditable;
}

function nearestElement(node: Node): Element {
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element;
  return node.parentElement ?? document.body;
}

function toRectLike(rect: DOMRect): DomRectLike {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function truncate(value: string, max: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max)}…`;
}

// When loaded as a plain <script> (the receiver serves it), auto-init against
// the origin it was served from. ESM importers have no currentScript, so they
// call init() themselves.
autoInitFromScriptTag();

function autoInitFromScriptTag(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script || !script.src) return;
  const origin = new URL(script.src);
  init({ host: origin.hostname, port: Number(origin.port) || DEFAULT_PORT });
}

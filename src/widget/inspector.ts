import { el } from "./ui/dom.js";

// Drives "pick mode": a hover highlight that tracks the element under the
// cursor, a click to pick an element, or a drag-select to pick a text range.
// Clicks are suppressed in the capture phase so the host page never activates.

export interface InspectorOptions {
  root: ShadowRoot;
  hostElement: HTMLElement;
  describe: (element: Element) => string;
  onPickElement: (element: Element) => void;
  onPickText: (range: Range) => void;
  onCancel: () => void;
}

export interface Inspector {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
}

export function createInspector(options: InspectorOptions): Inspector {
  const overlay = el("div", { class: "overlay" });
  const label = el("div", { class: "overlay-label" });
  hide();
  options.root.append(overlay, label);

  let active = false;
  let rafId = 0;
  let pending: MouseEvent | null = null;

  function start(): void {
    if (active) return;
    active = true;
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("mouseup", handleMouseUp, true);
    document.addEventListener("keydown", handleKeyDown, true);
  }

  function stop(): void {
    if (!active) return;
    active = false;
    document.documentElement.style.cursor = "";
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    hide();
  }

  function handleMouseMove(event: MouseEvent): void {
    pending = event;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (pending) updateHighlight(pending);
    });
  }

  function updateHighlight(event: MouseEvent): void {
    const target = elementUnder(event.clientX, event.clientY);
    if (!target) {
      hide();
      return;
    }
    const rect = target.getBoundingClientRect();
    positionOverlay(rect);
    positionLabel(rect, options.describe(target));
  }

  function handleClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const selection = window.getSelection();
    if (hasTextSelection(selection)) {
      finishText(selection.getRangeAt(0));
      return;
    }

    const target = elementUnder(event.clientX, event.clientY);
    if (target) finishElement(target);
  }

  // A drag-select fires mouseup but no click, so pick the text here.
  function handleMouseUp(): void {
    const selection = window.getSelection();
    if (hasTextSelection(selection)) finishText(selection.getRangeAt(0));
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    stop();
    options.onCancel();
  }

  function finishElement(element: Element): void {
    stop();
    options.onPickElement(element);
  }

  function finishText(range: Range): void {
    const cloned = range.cloneRange();
    stop();
    options.onPickText(cloned);
  }

  function elementUnder(x: number, y: number): Element | null {
    const found = document.elementFromPoint(x, y);
    if (!found) return null;
    if (found === options.hostElement || options.hostElement.contains(found)) return null;
    return found;
  }

  function positionOverlay(rect: DOMRect): void {
    overlay.style.display = "block";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function positionLabel(rect: DOMRect, text: string): void {
    label.textContent = text;
    label.style.display = "block";
    label.style.left = `${Math.max(4, rect.left)}px`;
    label.style.top = rect.top > 24 ? `${rect.top - 22}px` : `${rect.bottom + 4}px`;
  }

  function hide(): void {
    overlay.style.display = "none";
    label.style.display = "none";
  }

  return { start, stop, isActive: () => active };
}

function hasTextSelection(selection: Selection | null): selection is Selection {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  return selection.toString().trim().length > 0;
}

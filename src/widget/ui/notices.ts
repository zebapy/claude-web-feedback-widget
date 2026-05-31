import { el } from "./dom.js";

const TOAST_DURATION_MS = 2800;

export function showToast(root: ShadowRoot, message: string, tone: "info" | "error" = "info"): void {
  const toast = el("div", { class: "toast", "data-tone": tone });
  toast.textContent = message;
  root.append(toast);
  setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}

export interface Hint {
  destroy: () => void;
}

export function showHint(root: ShadowRoot, message: string): Hint {
  const hint = el("div", { class: "hint" });
  hint.textContent = message;
  root.append(hint);
  return { destroy: () => hint.remove() };
}

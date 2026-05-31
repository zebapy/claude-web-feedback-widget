import type { DomRectLike } from "../../shared/protocol.js";
import { el } from "./dom.js";

export interface CommentSubmission {
  comment: string;
  includeScreenshot: boolean;
}

export interface CommentFormOptions {
  root: ShadowRoot;
  title: string;
  anchorRect: DomRectLike;
  screenshotAvailable: boolean;
  onSubmit: (submission: CommentSubmission) => void;
  onCancel: () => void;
}

export interface CommentForm {
  destroy: () => void;
}

const FORM_WIDTH = 320;
const ESTIMATED_HEIGHT = 200;
const MARGIN = 8;

export function showCommentForm(options: CommentFormOptions): CommentForm {
  const title = el("p", { class: "form-title" });
  title.textContent = options.title;

  const textarea = el("textarea", {
    class: "form-textarea",
    placeholder: "Describe the change or issue…"
  });

  const checkbox = el("input", { type: "checkbox" });
  checkbox.checked = options.screenshotAvailable;
  checkbox.disabled = !options.screenshotAvailable;
  const checkboxLabel = el("label", { class: "form-check" }, [checkbox, "Include screenshot"]);

  const cancelButton = el("button", { type: "button", class: "button" }, ["Cancel"]);
  const sendButton = el("button", { type: "submit", class: "button button--primary" }, ["Send to Claude"]);

  const actions = el("div", { class: "form-actions" }, [cancelButton, sendButton]);
  const row = el("div", { class: "form-row" }, [checkboxLabel, actions]);
  const form = el("form", { class: "form" }, [title, textarea, row]);

  function destroy(): void {
    form.remove();
  }

  function submit(): void {
    const comment = textarea.value.trim();
    if (!comment) {
      textarea.focus();
      return;
    }
    options.onSubmit({ comment, includeScreenshot: checkbox.checked && options.screenshotAvailable });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });

  cancelButton.addEventListener("click", () => options.onCancel());

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      options.onCancel();
    }
  });

  options.root.append(form);
  position(form, options.anchorRect);
  textarea.focus();

  return { destroy };
}

function position(form: HTMLElement, rect: DomRectLike): void {
  const maxLeft = window.innerWidth - FORM_WIDTH - MARGIN;
  const left = clamp(rect.x, MARGIN, Math.max(MARGIN, maxLeft));

  const below = rect.y + rect.height + MARGIN;
  const fitsBelow = below + ESTIMATED_HEIGHT <= window.innerHeight - MARGIN;
  const top = fitsBelow ? below : Math.max(MARGIN, rect.y - ESTIMATED_HEIGHT - MARGIN);

  form.style.left = `${left}px`;
  form.style.top = `${top}px`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

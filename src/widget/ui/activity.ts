import { el } from "./dom.js";

// A session log of submitted comments and their delivery state, so the user can
// see what they sent and whether the receiver took it. Toggled from the toolbar.

export type ActivityStatus = "sending" | "sent" | "confirmed" | "failed";

export interface ActivityOptions {
  root: ShadowRoot;
  onCountChange?: (count: number) => void;
}

export interface Activity {
  add: (entry: { title: string; comment: string }) => string;
  setStatus: (id: string, status: ActivityStatus) => void;
  toggle: () => void;
  hide: () => void;
}

const STATUS_LABEL: Record<ActivityStatus, string> = {
  sending: "Sending…",
  sent: "Sent — awaiting receiver",
  confirmed: "Saved ✓ — ask Claude to read it",
  failed: "Failed — receiver offline"
};

interface Row {
  status: ActivityStatus;
  state: HTMLElement;
  root: HTMLElement;
}

export function createActivity(options: ActivityOptions): Activity {
  const rows = new Map<string, Row>();

  const heading = el("p", { class: "activity-title" }, ["Sent this session"]);
  const list = el("div", { class: "activity-list" });
  const panel = el("div", { class: "activity", hidden: "" }, [heading, list]);
  options.root.append(panel);

  function add(entry: { title: string; comment: string }): string {
    const id = crypto.randomUUID();

    const title = el("span", { class: "activity-item-title" });
    title.textContent = entry.title;
    const comment = el("p", { class: "activity-item-comment" });
    comment.textContent = entry.comment;
    const state = el("span", { class: "activity-item-state" });
    state.textContent = STATUS_LABEL.sending;

    const row = el("div", { class: "activity-item", "data-status": "sending" }, [title, comment, state]);
    list.prepend(row);
    rows.set(id, { status: "sending", state, root: row });

    options.onCountChange?.(rows.size);
    return id;
  }

  function setStatus(id: string, status: ActivityStatus): void {
    const row = rows.get(id);
    if (!row) return;
    row.status = status;
    row.state.textContent = STATUS_LABEL[status];
    row.root.setAttribute("data-status", status);
  }

  return {
    add,
    setStatus,
    toggle(): void {
      if (panel.hasAttribute("hidden")) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    },
    hide(): void {
      panel.setAttribute("hidden", "");
    }
  };
}

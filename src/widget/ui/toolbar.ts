import { el } from "./dom.js";

export interface ToolbarOptions {
  root: ShadowRoot;
  onToggleInspect: () => void;
  onToggleActivity: () => void;
}

export interface Toolbar {
  setConnected: (connected: boolean) => void;
  setInspecting: (inspecting: boolean) => void;
  setSentCount: (count: number) => void;
}

export function createToolbar(options: ToolbarOptions): Toolbar {
  const dot = el("span", { class: "status-dot", "data-connected": "false", title: "Receiver offline" });
  const button = el("button", { class: "button button--primary", type: "button" }, ["Comment"]);
  const sentButton = el("button", { class: "button", type: "button", hidden: "" }, ["Sent"]);
  const bar = el("div", { class: "toolbar" }, [dot, button, sentButton]);

  button.addEventListener("click", () => options.onToggleInspect());
  sentButton.addEventListener("click", () => options.onToggleActivity());
  options.root.append(bar);

  return {
    setConnected(connected: boolean): void {
      dot.setAttribute("data-connected", String(connected));
      dot.setAttribute("title", connected ? "Connected to Claude receiver" : "Receiver offline");
    },
    setInspecting(inspecting: boolean): void {
      button.classList.toggle("button--active", inspecting);
      button.textContent = inspecting ? "Cancel (Esc)" : "Comment";
    },
    setSentCount(count: number): void {
      if (count > 0) sentButton.removeAttribute("hidden");
      else sentButton.setAttribute("hidden", "");
      sentButton.textContent = `Sent (${count})`;
    }
  };
}

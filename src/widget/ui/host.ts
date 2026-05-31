import { widgetStyles } from "./styles.js";

// Open shadow root + a constructable stylesheet fully isolate the widget's
// styles from the host page (and vice versa). The host element is tagged so
// the inspector and screenshot capture can exclude the widget's own UI.

export interface WidgetHost {
  root: ShadowRoot;
  hostElement: HTMLElement;
  destroy: () => void;
}

export function createHost(): WidgetHost {
  const hostElement = document.createElement("div");
  hostElement.setAttribute("data-claude-feedback-host", "");
  document.documentElement.appendChild(hostElement);

  const root = hostElement.attachShadow({ mode: "open" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(widgetStyles);
  root.adoptedStyleSheets = [sheet];

  return {
    root,
    hostElement,
    destroy: (): void => hostElement.remove()
  };
}

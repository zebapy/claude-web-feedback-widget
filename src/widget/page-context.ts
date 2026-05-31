import type { PageContext } from "../shared/protocol.js";

export function buildPageContext(): PageContext {
  return {
    url: location.href,
    title: document.title,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

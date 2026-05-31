import type { DomRectLike, ElementAnchor } from "../../shared/protocol.js";
import { buildCssSelector } from "./css-selector.js";
import { getReactAnchor } from "./react-source.js";

const MAX_HTML_LENGTH = 1500;
const MAX_TEXT_LENGTH = 200;

export function buildElementAnchor(element: Element): ElementAnchor {
  const react = getReactAnchor(element);

  return {
    source: react.source,
    componentName: react.componentName,
    componentStack: react.componentStack,
    testId: element.getAttribute("data-testid") ?? undefined,
    cssSelector: buildCssSelector(element),
    ariaLabel: element.getAttribute("aria-label") ?? undefined,
    textContent: readText(element),
    tagName: element.tagName.toLowerCase(),
    outerHtml: truncate(element.outerHTML, MAX_HTML_LENGTH),
    rect: toRect(element.getBoundingClientRect())
  };
}

function readText(element: Element): string | undefined {
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return truncate(text, MAX_TEXT_LENGTH);
}

function toRect(rect: DOMRect): DomRectLike {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

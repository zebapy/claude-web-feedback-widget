// Build a stable, unique CSS selector by walking up from the target until the
// accumulated path matches exactly one node. Prefers data-testid and unique
// ids over structural nth-of-type. Never throws (we only emit valid selectors),
// so it needs no error boundary.

export function buildCssSelector(element: Element): string {
  if (isUniqueId(element.id)) return `#${escapeIdentifier(element.id)}`;

  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    segments.unshift(segmentFor(current));
    const selector = segments.join(" > ");
    if (matchesExactlyOne(selector)) return selector;
    current = current.parentElement;
  }

  return segments.join(" > ");
}

function segmentFor(element: Element): string {
  const tag = element.tagName.toLowerCase();

  const testId = element.getAttribute("data-testid");
  if (testId) return `${tag}[data-testid="${escapeAttributeValue(testId)}"]`;

  if (isUniqueId(element.id)) return `#${escapeIdentifier(element.id)}`;

  const index = nthOfTypeIndex(element);
  return index > 0 ? `${tag}:nth-of-type(${index})` : tag;
}

function nthOfTypeIndex(element: Element): number {
  const parent = element.parentElement;
  if (!parent) return 0;

  const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  if (siblings.length < 2) return 0;
  return siblings.indexOf(element) + 1;
}

function isUniqueId(id: string): boolean {
  if (!id) return false;
  return matchesExactlyOne(`#${escapeIdentifier(id)}`);
}

function matchesExactlyOne(selector: string): boolean {
  return document.querySelectorAll(selector).length === 1;
}

function escapeIdentifier(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeAttributeValue(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

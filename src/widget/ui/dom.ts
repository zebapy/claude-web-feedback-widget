// Tiny element builder. Sets text via textContent only — user/page content is
// never assigned through innerHTML, so nothing here can inject markup.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  children: Array<Node | string> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") {
      node.className = value;
      continue;
    }
    node.setAttribute(key, value);
  }

  for (const child of children) node.append(child);
  return node;
}

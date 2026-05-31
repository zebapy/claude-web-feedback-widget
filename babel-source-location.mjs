// Babel plugin: stamp `data-source-loc="relativePath:line:column"` on every JSX
// element during a dev build. The widget reads this attribute straight off the
// DOM, so the file:line anchor works on any React version and JSX runtime.
//
// Why this exists: React 19 removed the fiber `_debugSource`, and the automatic
// JSX runtime never puts `__source` on props — so walking the fiber can no longer
// recover a source location. A real DOM attribute survives both. Dev only; do not
// ship it to production (it leaks source paths and bloats markup).
//
// Usage (Vite):
//   import sourceLocation from "claude-web-feedback-widget/babel";
//   react({ babel: { plugins: [sourceLocation] } })
//
// Usage (Next / Babel): add "claude-web-feedback-widget/babel" to plugins in dev.

import { relative, isAbsolute } from "node:path";

const ATTRIBUTE = "data-source-loc";

export default function sourceLocationPlugin({ types }) {
  return {
    name: "claude-web-feedback-source-location",
    visitor: {
      JSXOpeningElement(path, state) {
        const location = path.node.loc;
        if (!location) return;

        if (hasAttribute(path.node.attributes)) return;

        const filename = state.file.opts.filename;
        if (!filename) return;

        const root = state.cwd ?? process.cwd();
        const relativePath = isAbsolute(filename) ? relative(root, filename) : filename;
        // Babel columns are 0-based; +1 to match what editors show.
        const value = `${relativePath}:${location.start.line}:${location.start.column + 1}`;

        path.node.attributes.push(
          types.jsxAttribute(types.jsxIdentifier(ATTRIBUTE), types.stringLiteral(value))
        );
      }
    }
  };
}

function hasAttribute(attributes) {
  return attributes.some(
    (attribute) => attribute.type === "JSXAttribute" && attribute.name?.name === ATTRIBUTE
  );
}

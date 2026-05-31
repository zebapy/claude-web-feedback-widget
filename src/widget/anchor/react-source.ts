import type { SourceLocation } from "../../shared/protocol.js";

// React tags each managed DOM node with a fiber under a randomised key.
// Walking `fiber.return` lets us read the JSX source location and the chain
// of component names that rendered the node.

interface RawSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

interface Fiber {
  return: Fiber | null;
  type: unknown;
  memoizedProps: Record<string, unknown> | null;
  pendingProps: Record<string, unknown> | null;
  _debugSource?: RawSource;
}

const MAX_WALK_DEPTH = 60;

export interface ReactAnchor {
  source?: SourceLocation;
  componentName?: string;
  componentStack?: string[];
}

export function getReactAnchor(element: Element): ReactAnchor {
  // Preferred: a `data-source-loc` attribute stamped by the babel plugin. It is
  // runtime-agnostic and works on React 19, which dropped the fiber source.
  let source = readDomSource(element);

  const start = findFiber(element);
  if (!start) return { source };

  const stack: string[] = [];
  let fiber: Fiber | null = start;
  let depth = 0;

  while (fiber && depth < MAX_WALK_DEPTH) {
    if (!source) {
      const found = readSource(fiber);
      if (found) source = found;
    }
    const name = readComponentName(fiber);
    if (name) stack.push(name);
    fiber = fiber.return;
    depth += 1;
  }

  return {
    source,
    componentName: stack[0],
    componentStack: stack.length > 0 ? stack : undefined
  };
}

// Reads the nearest `data-source-loc="path:line:column"` ancestor-or-self.
function readDomSource(element: Element): SourceLocation | undefined {
  const holder = element.closest("[data-source-loc]");
  const raw = holder?.getAttribute("data-source-loc");
  if (!raw) return undefined;
  return parseSourceLoc(raw);
}

function parseSourceLoc(raw: string): SourceLocation | undefined {
  // Split from the right so absolute Windows paths (C:\…) keep their colon.
  const lastColon = raw.lastIndexOf(":");
  if (lastColon < 0) return undefined;
  const prevColon = raw.lastIndexOf(":", lastColon - 1);
  if (prevColon < 0) return undefined;

  const fileName = raw.slice(0, prevColon);
  const lineNumber = Number(raw.slice(prevColon + 1, lastColon));
  const columnNumber = Number(raw.slice(lastColon + 1));
  if (!fileName || !Number.isFinite(lineNumber)) return undefined;

  return {
    fileName,
    lineNumber,
    columnNumber: Number.isFinite(columnNumber) ? columnNumber : undefined
  };
}

function findFiber(element: Element): Fiber | null {
  const key = Object.keys(element).find(
    (name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$")
  );
  if (!key) return null;
  const fiber = (element as unknown as Record<string, Fiber | undefined>)[key];
  return fiber ?? null;
}

function readSource(fiber: Fiber): SourceLocation | undefined {
  if (isRawSource(fiber._debugSource)) return normalize(fiber._debugSource);

  const props = fiber.memoizedProps ?? fiber.pendingProps;
  const fromProps = props?.["__source"];
  if (isRawSource(fromProps)) return normalize(fromProps);

  return undefined;
}

function readComponentName(fiber: Fiber): string | undefined {
  const type = fiber.type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return clean(fn.displayName ?? fn.name);
  }
  // forwardRef / memo wrappers store the inner component on `render` / `type`.
  if (type && typeof type === "object") {
    const wrapper = type as { displayName?: string; render?: { name?: string }; type?: { name?: string } };
    return clean(wrapper.displayName ?? wrapper.render?.name ?? wrapper.type?.name);
  }
  return undefined;
}

function clean(name: string | undefined): string | undefined {
  if (!name) return undefined;
  if (name === "Unknown" || name.length === 0) return undefined;
  return name;
}

function normalize(raw: RawSource): SourceLocation {
  return { fileName: raw.fileName, lineNumber: raw.lineNumber, columnNumber: raw.columnNumber };
}

function isRawSource(value: unknown): value is RawSource {
  if (!value || typeof value !== "object") return false;
  const candidate = value as RawSource;
  return typeof candidate.fileName === "string" && typeof candidate.lineNumber === "number";
}

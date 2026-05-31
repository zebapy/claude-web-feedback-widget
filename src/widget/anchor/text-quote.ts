import type { TextQuoteAnchor } from "../../shared/protocol.js";

// W3C TextQuoteSelector: anchor a text range by its content plus a little
// surrounding context, so it survives DOM reflow that would break offsets.

const CONTEXT_LENGTH = 32;

export function buildTextQuoteAnchor(range: Range): TextQuoteAnchor {
  const root = document.body;
  const prefix = textBefore(range, root).slice(-CONTEXT_LENGTH);
  const suffix = textAfter(range, root).slice(0, CONTEXT_LENGTH);

  return {
    exact: range.toString(),
    prefix: prefix.length > 0 ? prefix : undefined,
    suffix: suffix.length > 0 ? suffix : undefined
  };
}

function textBefore(range: Range, root: Node): string {
  const before = document.createRange();
  before.setStart(root, 0);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString();
}

function textAfter(range: Range, root: Node): string {
  const after = document.createRange();
  after.setStart(range.endContainer, range.endOffset);
  after.setEndAfter(root);
  return after.toString();
}

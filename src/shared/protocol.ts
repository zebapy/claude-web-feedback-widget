// Wire protocol shared between the browser widget and the local receiver.
// Type-only: this module is erased from the widget bundle (no runtime cost).

export const DEFAULT_PORT = 4747;
export const DEFAULT_HOST = "127.0.0.1";
export const PROTOCOL_VERSION = 1;

/** Source anchor (`file:line:column`) from the `data-source-loc` dev attribute. */
export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

export interface DomRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Layered references for locating a commented element in source, best-first. */
export interface ElementAnchor {
  source?: SourceLocation;
  componentName?: string;
  componentStack?: string[];
  testId?: string;
  cssSelector?: string;
  ariaLabel?: string;
  textContent?: string;
  tagName: string;
  outerHtml: string;
  rect: DomRectLike;
}

/** W3C TextQuoteSelector: locate a text range without relying on offsets. */
export interface TextQuoteAnchor {
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface PageContext {
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export interface ConsoleEntry {
  level: "error" | "warn";
  message: string;
  timestamp: string;
}

export type FeedbackKind = "element" | "text" | "page";

/** What the widget sends. `screenshot` is a PNG data URL the server persists. */
export interface FeedbackInput {
  kind: FeedbackKind;
  comment: string;
  page: PageContext;
  element?: ElementAnchor;
  text?: TextQuoteAnchor;
  consoleErrors: ConsoleEntry[];
  screenshot?: string;
}

/** What the receiver stores and the MCP tools return. */
export interface Feedback extends Omit<FeedbackInput, "screenshot"> {
  id: string;
  createdAt: string;
  screenshotPath?: string;
}

// Client -> server messages.
export type ClientMessage =
  | { type: "hello"; clientId: string; page: PageContext }
  | { type: "feedback"; payload: FeedbackInput }
  | { type: "ping" };

// Server -> client messages.
export type ServerMessage =
  | { type: "welcome"; protocolVersion: number }
  | { type: "ack"; id: string }
  | { type: "pong" };

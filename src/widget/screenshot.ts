import html2canvas from "html2canvas-pro";

// html2canvas-pro understands modern color spaces (oklch), so it survives
// Tailwind v4 themes that break the original html2canvas.

const MAX_SCALE = 2;

export function captureScreenshot(target: Element): Promise<string> {
  return html2canvas(target as HTMLElement, {
    backgroundColor: null,
    logging: false,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, MAX_SCALE),
    ignoreElements: (element: Element) => element.hasAttribute("data-claude-feedback-host")
  }).then((canvas) => canvas.toDataURL("image/png"));
}

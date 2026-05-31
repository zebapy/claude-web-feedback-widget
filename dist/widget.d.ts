interface WidgetOptions {
    host?: string;
    port?: number;
}
interface WidgetHandle {
    destroy: () => void;
}
declare function init(options?: WidgetOptions): WidgetHandle;

export { type WidgetHandle, type WidgetOptions, init };

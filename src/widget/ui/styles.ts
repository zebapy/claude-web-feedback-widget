// Scoped to the widget's shadow root, so plain selectors can't leak in or out.
// Dark theme by default for low eye strain over arbitrary host pages.

export const widgetStyles = `
:host {
  all: initial;
}

* {
  box-sizing: border-box;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

.toolbar {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 9999px;
  background: #16181d;
  border: 1px solid #2a2e37;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  color: #e6e8ec;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
  flex: none;
}

.status-dot[data-connected="true"] {
  background: #34d399;
}

.button {
  appearance: none;
  border: 1px solid #2a2e37;
  background: #23262d;
  color: #e6e8ec;
  font-size: 13px;
  line-height: 1;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.button:hover {
  background: #2c303a;
}

.button--primary {
  background: #6366f1;
  border-color: #6366f1;
  color: #ffffff;
}

.button--primary:hover {
  background: #5457e5;
}

.button--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button--active {
  background: #6366f1;
  border-color: #6366f1;
  color: #ffffff;
}

.overlay {
  position: fixed;
  z-index: 2147483645;
  pointer-events: none;
  border: 2px solid #6366f1;
  background: rgba(99, 102, 241, 0.12);
  border-radius: 3px;
  transition: all 60ms linear;
}

.overlay-label {
  position: fixed;
  z-index: 2147483645;
  pointer-events: none;
  max-width: 320px;
  padding: 3px 7px;
  border-radius: 6px;
  background: #6366f1;
  color: #ffffff;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646;
  padding: 8px 14px;
  border-radius: 9999px;
  background: #16181d;
  border: 1px solid #2a2e37;
  color: #e6e8ec;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.form {
  position: fixed;
  z-index: 2147483647;
  width: 320px;
  padding: 14px;
  border-radius: 12px;
  background: #16181d;
  border: 1px solid #2a2e37;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  color: #e6e8ec;
}

.form-title {
  font-size: 12px;
  color: #9aa0aa;
  margin: 0 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.form-textarea {
  width: 100%;
  min-height: 84px;
  resize: vertical;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #2a2e37;
  background: #0f1115;
  color: #e6e8ec;
  font-size: 13px;
  line-height: 1.5;
}

.form-textarea:focus {
  outline: 2px solid #6366f1;
  outline-offset: -1px;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}

.form-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #9aa0aa;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 8px;
}

.activity {
  position: fixed;
  bottom: 64px;
  right: 16px;
  z-index: 2147483646;
  width: 320px;
  max-height: 50vh;
  overflow-y: auto;
  padding: 12px;
  border-radius: 12px;
  background: #16181d;
  border: 1px solid #2a2e37;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  color: #e6e8ec;
}

.activity[hidden] {
  display: none;
}

.activity-title {
  margin: 0 0 8px;
  font-size: 12px;
  color: #9aa0aa;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.activity-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: #0f1115;
  border: 1px solid #2a2e37;
  border-left: 3px solid #6b7280;
}

.activity-item[data-status="sent"] {
  border-left-color: #f59e0b;
}

.activity-item[data-status="confirmed"] {
  border-left-color: #34d399;
}

.activity-item[data-status="failed"] {
  border-left-color: #b91c1c;
}

.activity-item-title {
  display: block;
  font-size: 12px;
  color: #9aa0aa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-item-comment {
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

.activity-item-state {
  font-size: 11px;
  color: #9aa0aa;
}

.toast {
  position: fixed;
  bottom: 72px;
  right: 16px;
  z-index: 2147483647;
  padding: 10px 14px;
  border-radius: 8px;
  background: #16181d;
  border: 1px solid #2a2e37;
  color: #e6e8ec;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.toast[data-tone="error"] {
  border-color: #b91c1c;
}
`;

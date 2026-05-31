import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import sourceLocation from "../../babel-source-location.mjs";

// The source-location babel plugin stamps `data-source-loc="file:line:col"` on
// every JSX element so the widget can resolve file:line from the DOM. React 19
// dropped the fiber source, so this attribute is how the anchor works now.
// (In a real app, gate this to dev only.)
export default defineConfig({
  plugins: [react({ babel: { plugins: [sourceLocation] } })],
  server: { port: 5173 }
});

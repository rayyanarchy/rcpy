import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The results page bundles engine/evals/results/*.json from outside web/.
    fs: { allow: [".."] },
    // Keep the browser's Host header so share links point at the dev server, not :3000.
    proxy: Object.fromEntries(
      ["/api", "/r/", "/health"].map((path) => [path, { target: "http://localhost:3000", changeOrigin: false }]),
    ),
  },
});

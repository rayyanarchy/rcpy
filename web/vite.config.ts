import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The results page bundles engine/evals/results/*.json from outside web/.
    fs: { allow: [".."] },
    proxy: {
      "/api": "http://localhost:3000",
      "/r": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});

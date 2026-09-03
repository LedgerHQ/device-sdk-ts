import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { API_ROUTE_PREFIXES } from "./src/api/routes";

const API_TARGET = process.env["MOCK_SERVER_URL"] ?? "http://127.0.0.1:9752";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset URLs, so the bundle survives being mounted under a sub-path.
  base: "./",
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 9753,
    // From the client's own list, so a new API call cannot be left behind.
    proxy: Object.fromEntries(
      API_ROUTE_PREFIXES.map((route) => [route, { target: API_TARGET }]),
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

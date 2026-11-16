import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { API_ROUTE_PREFIXES } from "./src/api/routes";

const API_TARGET = process.env["MOCK_SERVER_URL"] ?? "http://127.0.0.1:9752";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset URLs, so index.html finds its bundle whatever path it is
  // served from. The API calls stay root-absolute, like the server serving both.
  base: "./",
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 9753,
    // From the client's own list, so a new API call cannot be left behind.
    // The secure channel is not one of them: only Ledger Wallet opens it,
    // when it is pointed at this dev server instead of the mock server.
    proxy: {
      ...Object.fromEntries(
        API_ROUTE_PREFIXES.map((route) => [route, { target: API_TARGET }]),
      ),
      "/secure-channel": { target: API_TARGET, ws: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

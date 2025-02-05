import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    exclude: ["node_modules", "lib"],
    printConsoleTrace: true,
    silent: false,
  },
});

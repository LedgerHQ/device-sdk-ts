import baseConfig from "@ledgerhq/vitest-config-dmk";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.mjs"],
    coverage: {
      provider: "istanbul",
      reporter: ["lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.stub.ts", "src/index.ts", "index.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@root": path.resolve(__dirname, "."),
    },
  },
});

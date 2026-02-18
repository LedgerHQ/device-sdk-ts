import { defineConfig } from "vitest/config";
import baseConfig from "@ledgerhq/vitest-config-dmk";
import path from "path";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.mjs"],
    coverage: {
      provider: "istanbul",
      reporter: ["lcov", "text"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.stub.ts", "src/index.ts", "src/api/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@internal": path.resolve(__dirname, "src/internal"),
    },
  },
});

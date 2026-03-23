import baseConfig from "@ledgerhq/vitest-config-dmk";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["lcov", "text"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@root": path.resolve(import.meta.dirname),
      "@api": path.resolve(import.meta.dirname, "src/api"),
      "@internal": path.resolve(import.meta.dirname, "src/internal"),
    },
  },
});

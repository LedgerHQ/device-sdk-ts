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
      exclude: ["src/index.ts", "src/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@root": path.resolve(__dirname),
      "@api": path.resolve(__dirname, "src/api"),
      "@internal": path.resolve(__dirname, "src/internal"),
    },
  },
});

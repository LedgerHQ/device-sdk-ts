import baseConfig from "@ledgerhq/vitest-config-dmk";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.mjs"],
    coverage: {
      reporter: ["lcov", "text"],
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.stub.ts", "src/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@api": path.resolve(__dirname, "src/api"),
      "@internal": path.resolve(__dirname, "src/internal"),
      "@root": path.resolve(__dirname, "."),
    },
  },
});

import baseConfig from "@ledgerhq/vitest-config-dmk";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    setupFiles: ["./vitest.setup.mjs"],
    coverage: {
      reporter: ["lcov", "text"],
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.stub.ts",
        "src/index.ts",
        "src/api/index.ts",
        "src/**/__test-utils__/*",
      ],
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

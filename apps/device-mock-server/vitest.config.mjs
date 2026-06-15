import baseConfig from "@ledgerhq/vitest-config-dmk";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.mjs"],
    coverage: {
      provider: "istanbul",
      reporter: ["lcov", "text"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.stub.ts",
        "src/index.ts",
        "src/main.ts",
        "src/api/index.ts",
        "index.ts",
      ],
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

import baseConfig from "@ledgerhq/vitest-config-dmk";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["lcov", "text"],
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.stub.ts", "src/index.ts", "src/api/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@api": path.resolve(__dirname, "src/api"),
    },
  },
});

import baseConfig from "@ledgerhq/vitest-config-dmk";
import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

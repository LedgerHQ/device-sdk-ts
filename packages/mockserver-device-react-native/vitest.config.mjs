import baseConfig from "@ledgerhq/vitest-config-dmk";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    // For FileReader and Blob, which React Native provides too.
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    coverage: {
      provider: "istanbul",
      reporter: ["lcov", "text"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/__mocks__/**",
        "src/__tests__/**",
        "src/index.ts",
        "index.ts",
      ],
    },
  },
  resolve: {
    alias: {
      // The real package ships Flow and native modules Node cannot load.
      "react-native": path.resolve(__dirname, "src/__mocks__/react-native.ts"),
    },
  },
});

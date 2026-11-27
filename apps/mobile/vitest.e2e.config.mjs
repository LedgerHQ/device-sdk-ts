import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    // A Maestro step takes seconds on an emulator running a debug build.
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});

import { defineConfig } from "vitest/config";
import { vitestConfigDmk } from "@ledgerhq/vitest-config-dmk";

export default defineConfig({
  ...vitestConfigDmk,
  test: {
    ...vitestConfigDmk.test,
    setupFiles: ["./vitest.setup.mjs"],
  },
});

import { defineConfig } from "@playwright/test";

import { config } from "./playwright.config";

export const DEVTOOLS_SAMPLE_PORT = 3100;

// The DevTools app binds fixed WebSocket ports, so the specs run serially. The
// sample runs on its own port so a dev server on 3000 is never picked up.
// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  ...config,
  testDir: "./playwright/devtools",
  workers: 1,
  fullyParallel: false,
  use: { ...config.use, baseURL: `http://localhost:${DEVTOOLS_SAMPLE_PORT}` },
  webServer: {
    command: `pnpm next start -p ${DEVTOOLS_SAMPLE_PORT}`,
    port: DEVTOOLS_SAMPLE_PORT,
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
});

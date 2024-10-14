import { defineConfig, PlaywrightTestConfig } from "@playwright/test";
import path from "path";

export const config: PlaywrightTestConfig = {
  testDir: "./playwright/cases",
  retries: 2,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    trace: "on",
  },
  reporter: [["list"]],
  reportSlowTests: {
    max: 0,
    threshold: 60_000,
  },
  webServer: {
    command: `sh ${path.join(__dirname, "playwright/start-servers.sh")}`,
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
};

// eslint-disable-next-line no-restricted-syntax
export default defineConfig(config);

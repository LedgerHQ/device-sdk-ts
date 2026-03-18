import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";
import path from "path";

const TIMEOUT_SECONDS = 120;
const MS_PER_SECOND = 1000;

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
    timeout: TIMEOUT_SECONDS * MS_PER_SECOND,
    reuseExistingServer: !process.env.CI,
  },
};

// eslint-disable-next-line no-restricted-syntax
export default defineConfig(config);

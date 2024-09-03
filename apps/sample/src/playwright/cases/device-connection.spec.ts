import { test } from "@playwright/test";

import { givenDeviceIsConnected } from "@/playwright/utils/givenHandlers";
import { thenDeviceIsConnected } from "@/playwright/utils/thenHandlers";

test.describe("device connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("first device should connect", async ({ page }) => {
    await test.step("Connect device", async () => {
      // Given the device is connected
      await givenDeviceIsConnected(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page);
    });
  });
});

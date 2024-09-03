import { test } from "@playwright/test";

import { givenDeviceIsConnected } from "@/playwright/utils/givenHandlers";
import {
  thenDeviceIsConnected,
  thenDeviceIsDisconnected,
} from "@/playwright/utils/thenHandlers";
import { whenDisconnectDevice } from "@/playwright/utils/whenHandlers";

test.describe("device disconnection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("first device should disconnect", async ({ page }) => {
    await test.step("Connect device", async () => {
      // Given the device is connected
      await givenDeviceIsConnected(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page);
    });

    await test.step("Disconnect device", async () => {
      // When we disconnect the device
      await whenDisconnectDevice(page);

      // Then the device should be disconnected
      await thenDeviceIsDisconnected(page);
    });
  });
});

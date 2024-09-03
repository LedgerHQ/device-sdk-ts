import { test } from "@playwright/test";

import {
  thenDeviceIsConnected,
  thenDeviceIsDisconnected,
} from "@/playwright/utils/thenHandlers";
import {
  whenConnectingDevice,
  whenDisconnectDevice,
} from "@/playwright/utils/whenHandlers";

test.describe("device disconnection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("first device should disconnect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page);
    });

    await test.step("Then disconnect device", async () => {
      // When we disconnect the device
      await whenDisconnectDevice(page);

      // Then the device should be disconnected
      await thenDeviceIsDisconnected(page);
    });
  });
});

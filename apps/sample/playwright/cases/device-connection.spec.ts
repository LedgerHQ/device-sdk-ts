/* eslint-disable no-restricted-imports */
import { test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import { whenConnectingDevice } from "../utils/whenHandlers";

test.describe("device connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("first device should connect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });
  });

  test("second device should connect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Given second device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 1);
    });
  });
});

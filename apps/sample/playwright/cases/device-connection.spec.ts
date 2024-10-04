/* eslint-disable no-restricted-imports */
import { test } from "@playwright/test";

import {
  thenDeviceIsConnected,
  thenDeviceIsListedAndConnected,
} from "../utils/thenHandlers";
import { whenCloseDrawer, whenConnectingDevice } from "../utils/whenHandlers";

test.describe("device connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("first device should connect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });
  });

  test("second device should connect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("Given second device is connected", async () => {
      await whenConnectingDevice(page, false);

      await thenDeviceIsListedAndConnected(page, 1);
      await whenCloseDrawer(page);
    });
  });
});

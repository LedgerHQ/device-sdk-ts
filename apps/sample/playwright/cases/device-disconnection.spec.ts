/* eslint-disable no-restricted-imports */
import { test } from "@playwright/test";

import {
  thenDeviceIsConnected,
  thenDeviceIsListedAndConnected,
  thenNoDeviceIsConnected,
} from "../utils/thenHandlers";
import {
  whenCloseDrawer,
  whenConnectingDevice,
  whenDisconnectDevice,
  whenDisconnectListedDevice,
  whenOpenSelectDeviceDrawer,
} from "../utils/whenHandlers";

test.describe("device disconnection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("first device should disconnect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("Then disconnect device", async () => {
      await whenDisconnectDevice(page);

      await thenNoDeviceIsConnected(page);
    });
  });

  test("first and second devices should disconnect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("Given second device is connected", async () => {
      await whenConnectingDevice(page, false);

      await thenDeviceIsListedAndConnected(page, 1);

      await whenCloseDrawer(page);
    });

    await test.step("Then disconnect device", async () => {
      await whenOpenSelectDeviceDrawer(page);

      await whenDisconnectListedDevice(page);

      await whenDisconnectListedDevice(page);

      await whenCloseDrawer(page);

      await thenNoDeviceIsConnected(page);
    });
  });
});

/* eslint-disable no-restricted-imports */
import { test } from "@playwright/test";

import {
  thenDeviceIsConnected,
  thenNoDeviceIsConnected,
} from "../utils/thenHandlers";
import {
  whenConnectingDevice,
  whenDisconnectDevice,
} from "../utils/whenHandlers";

test.describe("device disconnection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("first device should disconnect", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then disconnect device", async () => {
      // When we disconnect the device
      await whenDisconnectDevice(page);

      // Then the device should be disconnected
      await thenNoDeviceIsConnected(page);
    });
  });

  test("first and second devices should disconnect", async ({ page }) => {
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

    await test.step("Then disconnect device", async () => {
      // When we disconnect the device
      await whenDisconnectDevice(page);

      // When we disconnect the device
      await whenDisconnectDevice(page);

      // Then the device should be disconnected
      await thenNoDeviceIsConnected(page);
    });
  });
});

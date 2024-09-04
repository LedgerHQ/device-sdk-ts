/* eslint-disable no-restricted-imports */
import { test } from "@playwright/test";

import {
  thenDeviceIsConnected,
  thenVerifyResponseContains,
} from "../utils/thenHandlers";
import {
  whenConnectingDevice,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";

test.describe("keyrings: sign message", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should sign a message via keyrings", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute sign message via keyrings", async () => {});
  });
});

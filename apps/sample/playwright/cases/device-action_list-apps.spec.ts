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

test.describe("device action: list apps", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should list apps via device action", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute list apps via device action", async () => {
      // When we navigate to device actions
      await whenNavigateTo(page, "/device-actions");

      // And execute the "List apps" command
      await whenExecuteDeviceAction(page, "List apps");

      // Then we verify the response contains "completed"
      await thenVerifyResponseContains(page, '"status": "completed"');
    });
  });
});

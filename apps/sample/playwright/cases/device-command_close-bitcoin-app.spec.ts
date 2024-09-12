/* eslint-disable no-restricted-imports */
import { test } from "@playwright/test";

import {
  thenDeviceIsConnected,
  thenVerifyResponseContains,
} from "../utils/thenHandlers";
import {
  whenCloseDrawer,
  whenConnectingDevice,
  whenExecuteDeviceCommand,
  whenNavigateTo,
} from "../utils/whenHandlers";

test.describe("device command: close bitcoin app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should open and close bitcoin app via device command", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute open app via device command", async () => {
      // When we navigate to device commands
      await whenNavigateTo(page, "/commands");

      // And execute the "Open app" command with app name "Bitcoin"
      await whenExecuteDeviceCommand(page, "Open app", {
        inputField: "input-text_appName",
        inputValue: "Bitcoin",
      });

      // Then we verify the response contains "SUCCESS" for opening the app
      await thenVerifyResponseContains(page, '"status": "SUCCESS"');
    });

    await test.step("Then execute close app via device command", async () => {
      // When we close the drawer (app interface)
      await whenCloseDrawer(page);

      // And execute the "Close app" command
      await whenExecuteDeviceCommand(page, "Close app");

      // Then we verify the response contains "SUCCESS" for closing the app
      await thenVerifyResponseContains(page, '"status": "SUCCESS"');
    });
  });
});

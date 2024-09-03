import { test } from "@playwright/test";

import { givenDeviceIsConnected } from "@/playwright/utils/givenHandlers";
import {
  thenDeviceIsConnected,
  thenVerifyResponseContains,
} from "@/playwright/utils/thenHandlers";
import {
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "@/playwright/utils/whenHandlers";

test.describe("device action: open bitcoin app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should open bitcoin app via device action", async ({ page }) => {
    await test.step("Connect device", async () => {
      // Given the device is connected
      await givenDeviceIsConnected(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page);
    });

    await test.step("execute open app via device action", async () => {
      // When we navigate to device actions
      await whenNavigateTo(page, "/device-action");

      // And execute the "Open app" command with app name "Bitcoin"
      await whenExecuteDeviceAction(page, "Open app", {
        inputField: "input_appName",
        inputValue: "Bitcoin",
      });

      // Then we verify the response contains "completed"
      await thenVerifyResponseContains(page, '"status": "completed"');
    });
  });
});

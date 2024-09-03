import { test } from "@playwright/test";

import { givenDeviceIsConnected } from "@/playwright/utils/givenHandlers";
import {
  thenDeviceIsConnected,
  thenVerifyResponseContains,
} from "@/playwright/utils/thenHandlers";
import {
  whenCloseDrawer,
  whenExecuteDeviceCommand,
  whenNavigateTo,
} from "@/playwright/utils/whenHandlers";

test.describe("device command: get app and version", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should get app and version via device command", async ({
    page,
  }) => {
    await test.step("Connect device", async () => {
      // Given the device is connected
      await givenDeviceIsConnected(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page);
    });

    await test.step("execute open app via device command", async () => {
      // When we navigate to device commands
      await whenNavigateTo(page, "/commands");

      // And execute the "Open app" command with app name "Bitcoin"
      await whenExecuteDeviceCommand(page, "Open app", {
        inputField: "input_appName",
        inputValue: "Bitcoin",
      });

      // Then we verify the response contains "SUCCESS" for opening the app
      await thenVerifyResponseContains(page, '"status": "SUCCESS"');
    });

    await test.step("execute get app and version via device command", async () => {
      // When we close the drawer (app interface)
      await whenCloseDrawer(page);

      // And execute the "Get app and version" command
      await whenExecuteDeviceCommand(page, "Get app and version");

      // Then we verify the response contains "SUCCESS" and the app name "Bitcoin"
      await thenVerifyResponseContains(page, '"status": "SUCCESS"');
      await thenVerifyResponseContains(page, "Bitcoin");
    });
  });
});

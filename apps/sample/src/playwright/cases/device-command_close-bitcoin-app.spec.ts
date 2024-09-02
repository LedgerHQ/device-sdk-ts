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

test("device command: close bitcoin app", async ({ page }) => {
  // Given the device is connected
  await givenDeviceIsConnected(page);

  // Then verify the device is connected
  await thenDeviceIsConnected(page);

  // When we navigate to device commands
  await whenNavigateTo(page, "/commands");

  // And execute the "Open app" command with app name "Bitcoin"
  await whenExecuteDeviceCommand(page, "Open app", {
    inputField: "input_appName",
    inputValue: "Bitcoin",
  });

  // Then we verify the response contains "SUCCESS" for opening the app
  await thenVerifyResponseContains(page, '"status": "SUCCESS"');

  // When we close the drawer (app interface)
  await whenCloseDrawer(page);

  // And execute the "Close app" command
  await whenExecuteDeviceCommand(page, "Close app");

  // Then we verify the response contains "SUCCESS" for closing the app
  await thenVerifyResponseContains(page, '"status": "SUCCESS"');
});

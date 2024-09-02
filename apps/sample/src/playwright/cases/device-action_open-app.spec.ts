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

test("device action: open app", async ({ page }) => {
  // Given the device is connected
  await givenDeviceIsConnected(page);

  // Then verify the device is connected
  await thenDeviceIsConnected(page);

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

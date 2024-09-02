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

test("device action: list apps", async ({ page }) => {
  // Given the device is connected
  await givenDeviceIsConnected(page);

  // Then verify the device is connected
  await thenDeviceIsConnected(page);

  // When we navigate to device actions
  await whenNavigateTo(page, "/device-action");

  // And execute the "List apps" command
  await whenExecuteDeviceAction(page, "List apps");

  // Then we verify the response contains "completed"
  await thenVerifyResponseContains(page, '"status": "completed"');
});

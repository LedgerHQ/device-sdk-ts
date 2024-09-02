import { test } from "@playwright/test";

import { givenDeviceIsConnected } from "@/playwright/utils/givenHandlers";
import { thenDeviceIsConnected } from "@/playwright/utils/thenHandlers";

test("device connection", async ({ page }) => {
  // Given the device is connected
  await givenDeviceIsConnected(page);

  // Then verify the device is connected
  await thenDeviceIsConnected(page);
});

import { test } from "@playwright/test";

import { givenDeviceIsConnected } from "@/playwright/utils/givenHandlers";
import {
  thenDeviceIsConnected,
  thenDeviceIsDisconnected,
} from "@/playwright/utils/thenHandlers";
import { whenDisconnectDevice } from "@/playwright/utils/whenHandlers";

test("device disconnection", async ({ page }) => {
  // Given the device is connected
  await givenDeviceIsConnected(page);

  // Then verify the device is connected
  await thenDeviceIsConnected(page);

  // When we disconnect the device
  await whenDisconnectDevice(page);

  // Then the device should be disconnected
  await thenDeviceIsDisconnected(page);
});

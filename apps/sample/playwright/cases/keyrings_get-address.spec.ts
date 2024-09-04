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

test.describe("keyrings: get address", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should get address via keyrings", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute get address via keyrings", async () => {
      // When we navigate to keyrings
      await whenNavigateTo(page, "/keyring");

      // select Etherium
      await page.getByTestId("CTA_command-Ethereum").click();

      await whenExecuteDeviceAction(page, "Get address");

      // Then we verify the response contains "completed"
      await thenVerifyResponseContains(page, '"status": "error"');
    });
  });
});

/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import { getLastDeviceResponseContent } from "../utils/utils";
import {
  whenConnectingDevice,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";

interface OpenAppResponse {
  status: string;
  error?: object;
  pending?: object;
}

test.describe("device action: open bitcoin app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should open bitcoin app via device action", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute open app via device action", async () => {
      // When we navigate to device actions
      await whenNavigateTo(page, "/device-actions");

      // And execute the "Open app" command with app name "Bitcoin"
      await whenExecuteDeviceAction(page, "Open app", {
        inputField: "input-text_appName",
        inputValue: "Bitcoin",
      });

      // Then we verify the response contains "completed"
      const response = (await getLastDeviceResponseContent(
        page,
      )) as OpenAppResponse;

      expect(response.status).toBe("completed");
    });
  });
});

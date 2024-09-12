/* eslint-disable no-restricted-imports */
import { test, expect } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import {
  whenConnectingDevice,
  whenExecuteDeviceCommand,
  whenNavigateTo,
} from "../utils/whenHandlers";
import { getLastDeviceResponseContent } from "../utils/utils";

interface commandOpenAppResponse {
  status: string;
  error?: object;
  pending?: object;
}

test.describe("device command: open bitcoin app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should open bitcoin app via device command", async ({
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
      const response = (await getLastDeviceResponseContent(
        page,
      )) as commandOpenAppResponse;

      expect(response.status).toBe("SUCCESS");
    });
  });
});

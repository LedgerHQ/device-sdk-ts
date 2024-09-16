/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import { getLastDeviceResponseContent } from "../utils/utils";
import {
  whenCloseDrawer,
  whenConnectingDevice,
  whenExecuteDeviceCommand,
  whenNavigateTo,
} from "../utils/whenHandlers";

interface CloseAppResponse {
  status: string;
  error?: object;
  pending?: object;
}

test.describe("device command: close bitcoin app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should open and close bitcoin app via device command", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute open app via device command", async () => {
      await whenNavigateTo(page, "/commands");

      await whenExecuteDeviceCommand(page, "Open app", {
        inputField: "input-text_appName",
        inputValue: "Bitcoin",
      });

      const response = (await getLastDeviceResponseContent(
        page,
      )) as CloseAppResponse;

      expect(response.status).toBe("SUCCESS");
    });

    await test.step("Then execute close app via device command", async () => {
      await whenCloseDrawer(page);

      await whenExecuteDeviceCommand(page, "Close app");

      const response = (await getLastDeviceResponseContent(
        page,
      )) as CloseAppResponse;

      expect(response.status).toBe("SUCCESS");
    });
  });
});

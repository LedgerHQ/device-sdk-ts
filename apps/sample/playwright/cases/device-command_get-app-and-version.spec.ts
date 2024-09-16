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

interface getAppAndVersionResponse {
  status: string;
  data?: {
    name: string;
    version: string;
    flags: object;
  };
  error?: object;
  pending?: object;
}

interface openAppResponse {
  status: string;
  error?: object;
  pending?: object;
}

test.describe("device command: get app and version", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should get app and version via device command", async ({
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
      )) as openAppResponse;

      expect(response.status).toBe("SUCCESS");
    });

    await test.step("Then execute get app and version via device command", async () => {
      await whenCloseDrawer(page);

      await whenExecuteDeviceCommand(page, "Get app and version");

      const response = (await getLastDeviceResponseContent(
        page,
      )) as getAppAndVersionResponse;

      expect(response.status).toBe("SUCCESS");
      expect(response?.data?.name).toBe("Bitcoin");
    });
  });
});

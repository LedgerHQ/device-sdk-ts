/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import { getLastDeviceResponseContent } from "../utils/utils";
import {
  whenConnectingDevice,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";

interface ListAppsResponse {
  status: string;
  output?: object[];
  error?: object;
  pending?: object;
}

test.describe("device action: list apps", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should list apps via device action", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute list apps via device action", async () => {
      await whenNavigateTo(page, "/device-actions");

      await whenExecuteDeviceAction(page, "List apps");

      await page.waitForTimeout(1000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as ListAppsResponse;

      expect(response.status).toBe("completed");
      expect(response.output).toBeInstanceOf(Array);
    });
  });
});

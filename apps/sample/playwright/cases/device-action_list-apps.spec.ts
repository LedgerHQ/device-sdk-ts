/* eslint-disable no-restricted-imports */
import { test, expect } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import {
  whenConnectingDevice,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";
import { getLastDeviceResponseContent } from "../utils/utils";

interface ListAppsResponse {
  status: string;
  output?: Object[];
  error?: object;
  pending?: object;
}

test.describe("device action: list apps", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should list apps via device action", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute list apps via device action", async () => {
      // When we navigate to device actions
      await whenNavigateTo(page, "/device-actions");

      // And execute the "List apps" command
      await whenExecuteDeviceAction(page, "List apps");

      await page.waitForTimeout(1000);

      // Then we verify the response contains "completed"
      const response = (await getLastDeviceResponseContent(
        page,
      )) as ListAppsResponse;

      expect(response.status).toBe("completed");
      expect(response.output).toBeInstanceOf(Array);
    });
  });
});

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

test.describe("keyrings: sign message", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should sign a message via keyrings", async ({ page }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute sign message via keyrings", async () => {
      // When we navigate to keyrings
      await whenNavigateTo(page, "/keyring");

      await page.getByTestId("CTA_command-Ethereum").click();

      // And execute the "Sign message" command with message "hello, world!"
      await whenExecuteDeviceAction(page, "Sign message", {
        inputField: "input-text_message",
        inputValue: "hello, world!",
      });

      // Then we verify the response contains "completed"
      await thenVerifyResponseContains(page, '"status": "completed"');
    });
  });
});

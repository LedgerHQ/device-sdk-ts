/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import {
  whenClicking,
  whenConnectingDevice,
  whenExecute,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";
import { getLastDeviceResponseContent } from "../utils/utils";

interface SignMessageResponse {
  status: string;
  output?: {
    r: string;
    s: string;
    v: string;
  };
  error?: object;
  pending?: object;
}

test.describe("ETH Signer: sign message, unhappy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should return error if pub key is malformed", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute ETH: get address with malformed derivation paths and verify error response", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "aa/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);

      await page.waitForTimeout(4000);

      //then verify it errors
      expect(
        ((await getLastDeviceResponseContent(page)) as SignMessageResponse)
          .status,
      ).toBe("error");

      await whenExecute("device-action")(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/aa/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);

      await page.waitForTimeout(4000);

      //then verify it errors
      expect(
        ((await getLastDeviceResponseContent(page)) as SignMessageResponse)
          .status,
      ).toBe("error");

      await whenExecute("device-action")(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/aa/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);

      await page.waitForTimeout(4000);

      //then verify it errors
      expect(
        ((await getLastDeviceResponseContent(page)) as SignMessageResponse)
          .status,
      ).toBe("error");

      await whenExecute("device-action")(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/aa/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);

      await page.waitForTimeout(4000);

      //then verify it errors
      expect(
        ((await getLastDeviceResponseContent(page)) as SignMessageResponse)
          .status,
      ).toBe("error");

      await whenExecute("device-action")(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/aa",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);

      await page.waitForTimeout(4000);

      //then verify it errors
      expect(
        ((await getLastDeviceResponseContent(page)) as SignMessageResponse)
          .status,
      ).toBe("error");
    });
  });
});

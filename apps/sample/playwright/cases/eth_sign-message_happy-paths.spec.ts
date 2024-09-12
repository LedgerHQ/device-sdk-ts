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
import { getLastDeviceResponseContent, isValid256BitHex } from "../utils/utils";

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

test.describe("ETH Signer: sign message, happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should sign a message when fed default derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute ETH: sign message", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);
    });

    await test.step("Then verify the response is successful and contains signed message", async () => {
      await page.waitForTimeout(4000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as SignMessageResponse;

      expect(response.status).toBe("completed");
      expect(isValid256BitHex(response?.output?.r || "")).toBe(true);
      expect(isValid256BitHex(response?.output?.s || "")).toBe(true);
    });
  });

  test("device should output a different signature when fed a different derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute ETH: sign message", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);
    });

    await test.step("Then verify the response with different address index is successful and contains a different signed message", async () => {
      await page.waitForTimeout(4000);

      const responseWithDefaultDerivationPath =
        (await getLastDeviceResponseContent(page)) as SignMessageResponse;

      await whenExecute("device-action")(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/1",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);

      await page.waitForTimeout(4000);

      const responseWithSecondDerivationPath =
        (await getLastDeviceResponseContent(page)) as SignMessageResponse;

      expect(responseWithDefaultDerivationPath?.output?.r).toBeDefined();
      expect(responseWithDefaultDerivationPath?.output?.s).toBeDefined();
      expect(responseWithSecondDerivationPath?.output?.r).toBeDefined();
      expect(responseWithSecondDerivationPath?.output?.s).toBeDefined();

      expect(responseWithDefaultDerivationPath?.output?.r).not.toBe(
        responseWithSecondDerivationPath?.output?.r,
      );
      expect(responseWithDefaultDerivationPath?.output?.s).not.toBe(
        responseWithSecondDerivationPath?.output?.s,
      );
    });
  });

  test("device should output a different signature when fed a different message", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute ETH: sign message", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, world!",
        },
      ]);
    });

    await test.step("Then verify the response with different message is successful and contains a different signed message", async () => {
      await page.waitForTimeout(4000);

      const responseWithDefaultMessage = (await getLastDeviceResponseContent(
        page,
      )) as SignMessageResponse;

      await whenExecute("device-action")(page, "Sign message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "Bonjour le monde!",
        },
      ]);

      await page.waitForTimeout(4000);

      const responseWithSecondMessage = (await getLastDeviceResponseContent(
        page,
      )) as SignMessageResponse;

      expect(responseWithDefaultMessage?.output?.r).toBeDefined();
      expect(responseWithDefaultMessage?.output?.s).toBeDefined();
      expect(responseWithSecondMessage?.output?.r).toBeDefined();
      expect(responseWithSecondMessage?.output?.s).toBeDefined();

      expect(responseWithDefaultMessage?.output?.r).not.toBe(
        responseWithSecondMessage?.output?.r,
      );
      expect(responseWithDefaultMessage?.output?.s).not.toBe(
        responseWithSecondMessage?.output?.s,
      );
    });
  });
});

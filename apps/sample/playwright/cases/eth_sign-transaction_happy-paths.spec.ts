/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import { getLastDeviceResponseContent, isValid256BitHex } from "../utils/utils";
import {
  whenClicking,
  whenConnectingDevice,
  whenExecute,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";

interface SignTransactionResponse {
  status: string;
  output?: {
    r: string;
    s: string;
    v: string;
  };
  error?: object;
  pending?: object;
}

test.describe("ETH Signer: sign transaction, happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  const rawTransactionHex =
    "0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca";

  test("device should sign a transaction when fed default derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("When execute ETH: sign transaction", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign transaction", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_transaction",
          inputValue: rawTransactionHex,
        },
      ]);
    });

    await test.step("Then verify the response is successful and contains signed transaction", async () => {
      await page.waitForTimeout(1000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as SignTransactionResponse;

      expect(response.status).toBe("completed");
      expect(isValid256BitHex(response?.output?.r || "")).toBe(true);
      expect(isValid256BitHex(response?.output?.s || "")).toBe(true);
    });
  });

  test("device should output a different result when fed a different derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("When execute ETH: sign transaction", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign transaction", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_transaction",
          inputValue: rawTransactionHex,
        },
      ]);
    });

    await test.step("Then verify the response with different address index is successful and contains a different signed message", async () => {
      await page.waitForTimeout(1000);

      const responseWithDefaultDerivationPath =
        (await getLastDeviceResponseContent(page)) as SignTransactionResponse;

      await whenExecute("device-action")(page, "Sign transaction", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/1",
        },
        {
          inputField: "input-text_transaction",
          inputValue: rawTransactionHex,
        },
      ]);

      await page.waitForTimeout(1000);

      const responseWithSecondDerivationPath =
        (await getLastDeviceResponseContent(page)) as SignTransactionResponse;

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
});

/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import { getLastDeviceResponseContent } from "../utils/utils";
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

test.describe("ETH Signer: sign transaction, unhappy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should return error if derivation path is malformed when signing a transaction", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute ETH: sign transaction with malformed derivation paths", async () => {
      await whenNavigateTo(page, "/keyring");
      await whenClicking(page, "CTA_command-Ethereum");

      const malformedDerivationPaths = [
        "aa'/60'/0'/0/0",
        "44'/aa'/0'/0/0",
        "44'/60'/aa'/0/0",
        "44'/60'/0'/aa/0",
        "44'/60'/0'/0/aa",
      ];

      const transactionHex =
        "0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca";

      await whenExecuteDeviceAction(page, "Sign transaction", [
        {
          inputField: "input-text_derivationPath",
          inputValue: malformedDerivationPaths[0],
        },
        {
          inputField: "input-text_transaction",
          inputValue: transactionHex,
        },
      ]);

      await page.waitForTimeout(1000);

      expect(
        ((await getLastDeviceResponseContent(page)) as SignTransactionResponse)
          .status,
      ).toBe("error");

      for (let i = 1; i < malformedDerivationPaths.length; i++) {
        const path = malformedDerivationPaths[i];

        await whenExecute("device-action")(page, "Sign transaction", [
          {
            inputField: "input-text_derivationPath",
            inputValue: path,
          },
          {
            inputField: "input-text_transaction",
            inputValue: transactionHex,
          },
        ]);

        await page.waitForTimeout(1000);

        expect(
          (
            (await getLastDeviceResponseContent(
              page,
            )) as SignTransactionResponse
          ).status,
        ).toBe("error");
      }
    });
  });
});

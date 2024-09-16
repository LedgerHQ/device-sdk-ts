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

interface GetAddressResponse {
  status: string;
  output?: {
    publicKey: string;
    address: string;
  };
  error?: object;
  pending?: object;
}

test.describe("ETH Signer: get address, unhappy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should return error if pub key is malformed", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute ETH: get address with malformed derivation paths", async () => {
      await whenNavigateTo(page, "/keyring");
      await whenClicking(page, "CTA_command-Ethereum");

      const malformedDerivationPaths = [
        "aa'/60'/0'/0/0",
        "44'/aa'/0'/0/0",
        "44'/60'/aa'/0/0",
        "44'/60'/0'/aa/0",
        "44'/60'/0'/0/aa",
      ];

      await whenExecuteDeviceAction(page, "Get address", {
        inputField: "input-text_derivationPath",
        inputValue: malformedDerivationPaths[0],
      });

      await page.waitForTimeout(1000);

      expect(
        ((await getLastDeviceResponseContent(page)) as GetAddressResponse)
          .status,
      ).toBe("error");

      for (let i = 1; i < malformedDerivationPaths.length; i++) {
        const path = malformedDerivationPaths[i];

        await whenExecute("device-action")(page, "Get address", {
          inputField: "input-text_derivationPath",
          inputValue: path,
        });

        await page.waitForTimeout(1000);

        expect(
          ((await getLastDeviceResponseContent(page)) as GetAddressResponse)
            .status,
        ).toBe("error");
      }
    });
  });
});

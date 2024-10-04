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

interface SignEIP712MessageResponse {
  status: string;
  output?: {
    r: string;
    s: string;
    v: string;
  };
  error?: object;
  pending?: object;
}

test.describe("ETH Signer: sign EIP712 message, unhappy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should return error if derivation path is malformed when signing a typed message", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("When execute ETH: sign typed message with malformed derivation paths", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      const malformedDerivationPaths = [
        "aa'/60'/0'/0/0",
        "44'/aa'/0'/0/0",
        "44'/60'/aa'/0/0",
        "44'/60'/0'/aa/0",
        "44'/60'/0'/0/aa",
      ];

      const message = `{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}`;

      await whenExecuteDeviceAction(page, "Sign typed message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: malformedDerivationPaths[0],
        },
        {
          inputField: "input-text_message",
          inputValue: message,
        },
      ]);

      await page.waitForTimeout(1000);

      expect(
        (
          (await getLastDeviceResponseContent(
            page,
          )) as SignEIP712MessageResponse
        ).status,
      ).toBe("error");

      for (let i = 1; i < malformedDerivationPaths.length; i++) {
        const path = malformedDerivationPaths[i];

        await whenExecute("device-action")(page, "Sign typed message", [
          {
            inputField: "input-text_derivationPath",
            inputValue: path,
          },
          {
            inputField: "input-text_message",
            inputValue: message,
          },
        ]);

        await page.waitForTimeout(1000);

        expect(
          (
            (await getLastDeviceResponseContent(
              page,
            )) as SignEIP712MessageResponse
          ).status,
        ).toBe("error");
      }
    });
  });
});

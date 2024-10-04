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

test.describe("ETH Signer: sign EIP712 message, happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should sign an EIP712 message when fed default derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("When execute ETH: sign EIP712 message", async () => {
      await whenNavigateTo(page, "/keyring");
      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign typed message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue:
            '{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}',
        },
      ]);
    });

    await test.step("Then verify the response is successful and contains signed message", async () => {
      await page.waitForTimeout(1000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as SignEIP712MessageResponse;

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

    await test.step("When execute ETH: sign EIP712 message", async () => {
      await whenNavigateTo(page, "/keyring");
      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign typed message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue:
            '{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}',
        },
      ]);
    });

    await test.step("Then verify the response with different address index is successful and contains a different signed message", async () => {
      await page.waitForTimeout(1000);

      const responseWithDefaultDerivationPath =
        (await getLastDeviceResponseContent(page)) as SignEIP712MessageResponse;

      await whenExecute("device-action")(page, "Sign typed message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/1",
        },
        {
          inputField: "input-text_message",
          inputValue:
            '{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}',
        },
      ]);

      await page.waitForTimeout(1000);

      const responseWithSecondDerivationPath =
        (await getLastDeviceResponseContent(page)) as SignEIP712MessageResponse;

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

  test("device should output a different result when fed a different EIP712 message", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page);
    });

    await test.step("When execute ETH: sign EIP712 message", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Sign typed message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue:
            '{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}',
        },
      ]);
    });

    await test.step("Then verify the response with different EIP712 message is successful and contains a different signed message", async () => {
      await page.waitForTimeout(1000);

      const responseWithDefaultMessage = (await getLastDeviceResponseContent(
        page,
      )) as SignEIP712MessageResponse;

      await whenExecute("device-action")(page, "Sign typed message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/60'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue:
            '{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afda5cd","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}',
        },
      ]);

      await page.waitForTimeout(1000);

      const responseWithSecondMessage = (await getLastDeviceResponseContent(
        page,
      )) as SignEIP712MessageResponse;

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

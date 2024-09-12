/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import {
  getLastDeviceResponseContent,
  isValidEthereumAddress,
  isValidPublicKey,
} from "../utils/utils";
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

test.describe("ETH Signer: get address, happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should return ETH pubKey and address when fed default derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute ETH: get address", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Get address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/60'/0'/0/0",
      });
    });

    await test.step("Then verify that response is successful and it contains an address and pKey", async () => {
      await page.waitForTimeout(1000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as GetAddressResponse;

      expect(response.status).toBe("completed");
      expect(isValidEthereumAddress(response?.output?.address || "")).toBe(
        true,
      );
      expect(isValidPublicKey(response?.output?.publicKey || "")).toBe(true);
    });
  });

  test("device should return ETH pubKey and address when fed default derivation path and wait to checked on device", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute ETH: get address with checkOnDevice on", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenClicking(page, "CTA_command-Get address");

      await whenClicking(page, "input-switch_checkOnDevice");

      await whenExecute("device-action")(page, "Get address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/60'/0'/0/0",
      });
    });

    await test.step("Then verify that response is successful and it contains an address and pKey after timeout", async () => {
      await page.waitForTimeout(1000);
      expect(
        ((await getLastDeviceResponseContent(page)) as GetAddressResponse)
          .status,
      ).toBe("pending");

      await page.waitForTimeout(1000);
      expect(
        ((await getLastDeviceResponseContent(page)) as GetAddressResponse)
          .status,
      ).toBe("pending");

      await page.waitForTimeout(2000);
      const response = (await getLastDeviceResponseContent(
        page,
      )) as GetAddressResponse;

      expect(response.status).toBe("completed");
      expect(isValidEthereumAddress(response?.output?.address || "")).toBe(
        true,
      );
      expect(isValidPublicKey(response?.output?.publicKey || "")).toBe(true);
    });
  });

  test("device should return a different ETH pubKey and address when fed a different derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      // When we connect the device
      await whenConnectingDevice(page);

      // Then verify the device is connected
      await thenDeviceIsConnected(page, 0);
    });

    await test.step("Then execute ETH: get address", async () => {
      await whenNavigateTo(page, "/keyring");

      await whenClicking(page, "CTA_command-Ethereum");

      await whenExecuteDeviceAction(page, "Get address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/60'/0'/0/0",
      });
    });

    await test.step("Then veryfy that the address with a different derivation path is different", async () => {
      await page.waitForTimeout(1000);

      const addressWithFirstAddressIndex = (
        (await getLastDeviceResponseContent(page)) as GetAddressResponse
      )?.output?.address;

      await whenExecute("device-action")(page, "Get address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/60'/0'/0/1",
      });

      await page.waitForTimeout(1000);

      const addressWithSecondAddressIndex = (
        (await getLastDeviceResponseContent(page)) as GetAddressResponse
      )?.output?.address;

      expect(addressWithFirstAddressIndex).not.toBe(
        addressWithSecondAddressIndex,
      );
    });
  });
});

/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";
import { isValidEthereumAddress } from "../../../utils/utils";

const STAX_WITH_ETH: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Ethereum", version: "1.22.0" },
  ],
  masks: [0x33200000],
};

interface GetAddressOutput {
  address: string;
  publicKey: string;
  chainCode?: string;
}

test.describe("signer ethereum: get address", () => {
  test("returns an address with default inputs (no options selected)", async ({
    device,
    ethSigner,
  }) => {
    // Opening the Ethereum app provisions a real Speculos instance, which can
    // take a while to become ready.
    test.setTimeout(120_000);

    await test.step("Given the device with the Ethereum app is connected", async () => {
      await device.addAndConnect(STAX_WITH_ETH);
    });

    await test.step("When Get address is executed with default inputs", async () => {
      await ethSigner.open();
      await ethSigner.getAddress();
    });

    await test.step("Then a valid Ethereum address is returned", async () => {
      const result = await ethSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      expect(isValidEthereumAddress(result.output!.address)).toBe(true);
    });
  });
});

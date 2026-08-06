/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX_WITH_TRX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Tron", version: "0.7.4" },
  ],
  masks: [0x33200000],
};

// The hw-app-trx signTransactionHash doc vector (32-byte hash, hex-encoded).
const TX_HASH =
  "25b18a55f86afb10e7aca38d0073d04c80397c6636069193953fdefaea0b8369";

test.describe("signer tron: sign transaction hash", () => {
  // Hash signing is gated by the Tron app's "sign by hash" setting, which is
  // disabled by default and cannot be toggled from the e2e driver. This case
  // documents the gating behavior: the app refuses the command outright.
  test("fails when the 'sign by hash' setting is disabled on the device", async ({
    device,
    trxSigner,
    speculos,
    deviceActions,
  }) => {
    // Opening the Tron app provisions a real Speculos instance, so this flow
    // is slow even though the command itself is refused without interaction.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given the device with the Tron app is connected", async () => {
      dev = await device.addAndConnect(STAX_WITH_TRX);
    });

    await test.step("When Sign transaction hash is executed", async () => {
      await trxSigner.open();
      await trxSigner.signTransactionHash(TX_HASH);
      await speculos(dev).waitReady();
    });

    await test.step("Then the device action ends in error", async () => {
      // The app refuses hash signing when "sign by hash" is disabled, so the
      // device action fails with a TronAppCommandError (6a8c). Device-action
      // errors are rendered via util.inspect (not the JSON status envelope), so
      // assert on the rendered error text rather than a "status" field.
      const error = await deviceActions.expectError("TronAppCommandError", {
        timeout: 90_000,
      });

      expect(error).toContain("6a8c");
    });
  });
});

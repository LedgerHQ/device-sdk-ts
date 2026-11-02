import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "@root/playwright/fixtures";

const NANO_X_WITH_ALEO: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.8.0",
  apps: [
    { name: "BOLOS", version: "2.8.0" },
    { name: "Aleo", version: "1.4.1" },
  ],
  masks: [0x33000000],
};

// Recorded from the app for the fixed Speculos seed and 44'/683'/0'/0'.
const EXPECTED_ADDRESS =
  "aleo1u3tu8qc4k8472hhtkfqvt4hjkqdp79wrgzdggspwp8egjjl77c9sj5gk7q";

test.describe("signer aleo: get address", () => {
  test("returns the address for the default derivation path", async ({
    device,
    aleoSigner,
  }) => {
    // Opening the Aleo app provisions a real Speculos instance.
    test.setTimeout(120_000);

    await test.step("Given the device with the Aleo app is connected", async () => {
      await device.addAndConnect(NANO_X_WITH_ALEO);
    });

    await test.step("When Get Address is executed with default inputs", async () => {
      await aleoSigner.open();
      await aleoSigner.getAddress();
    });

    await test.step("Then the expected Aleo address is returned", async () => {
      const result = await aleoSigner.lastResult<{ address: string }>();

      expect(result.status).toBe("completed");
      expect(result.output?.address).toBe(EXPECTED_ADDRESS);
    });
  });
});

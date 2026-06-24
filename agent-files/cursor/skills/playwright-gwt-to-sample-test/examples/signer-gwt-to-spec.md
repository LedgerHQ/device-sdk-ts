# Example: Signer action with Speculos approval

## Input spec

```
GIVEN a connected Stax with the Ethereum app installed
WHEN Get address is executed with on-device verification
AND the address is approved on the Speculos screen
THEN status completed is returned with address 0x47609D32EdF0C2A046D8D1D22680A2F93c78661b
```

## Classification

- Family: Ethereum signer + Speculos
- Fixtures: `device`, `ethSigner`, `speculos`
- Output: `apps/sample/playwright/cases/signers/ethereum/get-address_on-device_stax.spec.ts`
- Slow test: `test.setTimeout(120_000)`

## Generated spec (excerpt)

```ts
/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

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

const EXPECTED_ADDRESS = "0x47609D32EdF0C2A046D8D1D22680A2F93c78661b";

interface GetAddressOutput {
  address: string;
  publicKey: string;
}

test.describe("signer ethereum: get address", () => {
  test("validates the address on the device screen", async ({
    device,
    ethSigner,
    speculos,
  }) => {
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given a connected Stax with the Ethereum app installed", async () => {
      dev = await device.addAndConnect(STAX_WITH_ETH);
    });

    const emulator = speculos(dev);

    await test.step("When Get address is executed with on-device verification", async () => {
      await ethSigner.open();
      await ethSigner.getAddress({ checkOnDevice: true });
    });

    await test.step("And the address is approved on the Speculos screen", async () => {
      await emulator.waitReady();
      await emulator.approve();
    });

    await test.step("Then status completed is returned with address 0x47609D32EdF0C2A046D8D1D22680A2F93c78661b", async () => {
      const result = await ethSigner.lastResult<GetAddressOutput>();

      expect(result.status).toBe("completed");
      expect(result.output!.address).toBe(EXPECTED_ADDRESS);
    });
  });
});
```

## Notes

- `dev` captured for `speculos(dev)`.
- `getAddress({ checkOnDevice: true })` maps to "on-device verification".
- Expected address provided by author (deterministic Speculos seed).
- Existing driver method — no driver extension needed.
- Mirrors `get-address.spec.ts` second test case.

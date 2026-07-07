# Example: OS command (no APDU mock)

## Input spec

```
GIVEN a connected Stax with firmware 1.3.0 at the dashboard
WHEN the Get app and version command is executed
THEN the dashboard app BOLOS version 1.3.0 is returned with status SUCCESS
```

## Classification

- Family: OS command
- Fixtures: `device`, `commands`
- Output: `apps/sample/playwright/cases/device/command/get-app-and-version_stax.spec.ts`
- No APDU mock (derived from device config)

## Generated spec (excerpt)

```ts
/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

const STAX: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.3.0",
  apps: [{ name: "BOLOS", version: "1.6.0" }],
  masks: [0x33200000],
};

interface GetAppAndVersionResponse {
  status: string;
  data?: { name: string; version: string };
  error?: object;
}

test.describe("device command: get app and version", () => {
  test("returns BOLOS dashboard version on stax", async ({
    device,
    commands,
  }) => {
    await test.step("Given a connected Stax with firmware 1.3.0 at the dashboard", async () => {
      await device.addAndConnect(STAX);
    });

    await test.step("When the Get app and version command is executed", async () => {
      await commands.goto();
      await commands.execute("Get app and version");
    });

    await test.step("Then the dashboard app BOLOS version 1.3.0 is returned with status SUCCESS", async () => {
      const response = await commands.lastResponse<GetAppAndVersionResponse>();

      expect(response.status).toBe("SUCCESS");
      expect(response.data?.name).toBe("BOLOS");
      expect(response.data?.version).toBe("1.3.0");
    });
  });
});
```

## Notes

- Expected values (`BOLOS`, `1.3.0`, `SUCCESS`) came from the spec.
- Command label `"Get app and version"` matches the sample app UI.
- Mirrors `get-app-and-version.spec.ts` structure.

# Example: APDU mock + device status

## Input spec

```
GIVEN a connected Nano X with firmware 2.2.3
WHEN GetAppAndVersion is mocked to return device locked (5515)
THEN the device status becomes LOCKED
WHEN the 5515 mock is removed
THEN the device status returns to CONNECTED
```

## Classification

- Family: device status / APDU mock
- Fixtures: `device`, `mockClient`, `sidebar`
- Output: `apps/sample/playwright/cases/device/device-locked.spec.ts` (or new variant)
- APDU: natural language → `prefix: b0010000`, `response: 5515`

## Generated spec (excerpt)

```ts
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { test } from "@root/playwright/fixtures";

const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  masks: [0x33000000],
};

const GET_APP_AND_VERSION_PREFIX = "b0010000";
const LOCKED_RESPONSE = "5515";

test.describe("device status: locked", () => {
  test("reports LOCKED on 5515 and CONNECTED again once cleared", async ({
    device,
    mockClient,
    sidebar,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given a connected Nano X with firmware 2.2.3", async () => {
      dev = await device.addAndConnect(NANO_X);
    });

    let lockMockId = "";
    await test.step("When GetAppAndVersion is mocked to return device locked (5515)", async () => {
      const mock = await mockClient.addMock(dev.id, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
      lockMockId = mock.id;
    });

    await test.step("Then the device status becomes LOCKED", async () => {
      await sidebar.expectStatus("LOCKED");
    });

    await test.step("When the 5515 mock is removed", async () => {
      await mockClient.deleteMock(dev.id, lockMockId);
    });

    await test.step("Then the device status returns to CONNECTED", async () => {
      await sidebar.expectStatus("CONNECTED");
    });
  });
});
```

## APDU resolution trail

| Spec term            | Resolved value            | Source                                                       |
| -------------------- | ------------------------- | ------------------------------------------------------------ |
| GetAppAndVersion     | prefix `b0010000`         | `GetAppAndVersionCommand.getApdu()` — cla `0xb0`, ins `0x01` |
| device locked (5515) | `response: "5515"`        | `apdu-reference.md` status words                             |
| LOCKED / CONNECTED   | `sidebar.expectStatus(…)` | `SidebarDriver`                                              |

## Notes

- `mockClient` fixture required (owns session lifecycle).
- Store `lockMockId` to delete mock in a later step.
- Comment on refresher polling optional but matches existing style.
- Identical structure to `device-locked.spec.ts`.

## Variant: explicit hex in spec

If the author writes:

```
WHEN APDU prefix b0010000 is mocked with response 5515
```

Use the hex directly — skip Confluence lookup.

## Variant: GetOsVersion error sequence

```
GIVEN a connected Nano X with GetOsVersion mock sequence [OK, OK, ERROR_5515]
WHEN Get OS version is executed four times
THEN executions 1-2 succeed, 3 fails, 4 succeeds again
```

Use `device.add()` → `addMock` with `responses` array → `device.connect()`. See `get-os-version_error-sequence_nano-x.spec.ts`.

## Variant: import session snapshot

`MockClient.importSession(snapshot)` **replaces the session's devices and mocks** with a previously exported snapshot, returning the resulting (normalized) state. Any devices or mocks that existed before import are discarded — use this when the whole scenario (device config + APDU overrides) is defined upfront, not when tweaking mocks mid-test.

The author names the snapshot file in the GIVEN step (e.g. `nano-x-locked.json`). Resolve it to `apps/sample/playwright/snapshots/{filename}`. Keep the JSON committed alongside specs — never inline the snapshot in the `.spec.ts`.

Mocks are nested under each device (`DeviceConfig.mocks`). Only configuration is captured (no ids, connection state, or response cursors).

### Input spec

```
GIVEN session snapshot nano-x-locked.json is imported
WHEN the device is connected
THEN the device status becomes LOCKED
```

The snapshot file encodes the device model, firmware, and APDU mocks (Nano X + GetAppAndVersion → 5515 in this example). Device/mock details belong in the JSON, not repeated in the GIVEN/WHEN/THEN lines.

### Classification

- Family: device status / APDU mock (session import)
- Fixtures: `device`, `mockClient`, `sidebar`
- Snapshot file: `apps/sample/playwright/snapshots/nano-x-locked.json` (from the GIVEN filename)
- API: load snapshot from disk → `mockClient.importSession(snapshot)` → `device.connect()` — do not call `addAndConnect` before import; import creates the device

### Snapshot file

`apps/sample/playwright/snapshots/nano-x-locked.json`:

```json
{
  "devices": [
    {
      "name": "Ledger Nano X",
      "device_type": "nanoX",
      "connectivity_type": "USB",
      "firmware_version": "2.2.3",
      "masks": [855638016],
      "mocks": [
        {
          "prefix": "b0010000",
          "response": "5515"
        }
      ]
    }
  ]
}
```

### Generated spec (excerpt)

Derive `SNAPSHOT` from the filename in the GIVEN step:

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { type SessionExport } from "@ledgerhq/device-mockserver-client";

import { test } from "@root/playwright/fixtures";

const SNAPSHOT = fileURLToPath(
  new URL("../../snapshots/nano-x-locked.json", import.meta.url),
);

test.describe("device status: locked via import", () => {
  test("reports LOCKED after importing nano-x-locked.json", async ({
    device,
    mockClient,
    sidebar,
  }) => {
    await test.step("Given session snapshot nano-x-locked.json is imported", async () => {
      const snapshot = JSON.parse(
        await readFile(SNAPSHOT, "utf-8"),
      ) as SessionExport;
      await mockClient.importSession(snapshot);
    });

    await test.step("When the device is connected", async () => {
      await device.connect();
    });

    await test.step("Then the device status becomes LOCKED", async () => {
      await sidebar.expectStatus("LOCKED");
    });
  });
});
```

### Import vs runtime `addMock`

| Approach                        | Use when                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `addMock` after `addAndConnect` | Mock is applied or removed mid-scenario (lock/unlock, sequence tweaks)           |
| `importSession` + snapshot file | Replace whole session from `playwright/snapshots/{file}` named in the GIVEN step |

Response sequences in snapshot files use `responses: […]` (same shape as `addMock`). Shorthand `response: "5515"` is equivalent to `responses: ["5515"]`.

# DeviceConfig presets

`DeviceConfig` comes from `@ledgerhq/device-mockserver-client`. Build from the spec; use these as templates.

## Required fields

```ts
{
  name: string;           // e.g. "Ledger Nano X"
  device_type: string;    // "nanoX" | "stax" | "flex" | "nanoS" | …
  connectivity_type: "USB";
  firmware_version: string;
  apps?: { name: string; version: string }[];
  masks: number[];        // device family mask — see table below
}
```

## Device type → masks

| device_type | masks          |
| ----------- | -------------- |
| `nanoX`     | `[0x33000000]` |
| `stax`      | `[0x33200000]` |
| `flex`      | `[0x33300000]` |

## Common presets (from existing tests)

### Nano X — dashboard only

```ts
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.5.0" }],
  masks: [0x33000000],
};
```

### Nano X — with Bitcoin

```ts
const NANO_X_WITH_BTC: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.7.1",
  apps: [
    { name: "BOLOS", version: "2.7.1" },
    { name: "Bitcoin", version: "2.4.6" },
  ],
  masks: [0x33000000],
};
```

### Stax — with Ethereum

```ts
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
```

### Flex — BOLOS only (app not installed scenarios)

```ts
const FLEX_BOLOS_ONLY: DeviceConfig = {
  name: "Ledger Flex",
  device_type: "flex",
  connectivity_type: "USB",
  firmware_version: "1.3.0",
  apps: [{ name: "BOLOS", version: "1.3.0" }],
  masks: [0x33300000],
};
```

## Derived vs explicit APDU responses

Many commands need **no explicit mock** — the mock server derives responses from `device_type`, `firmware_version`, and `apps`:

- **Get OS version** — `seVersion` matches `firmware_version`; `targetId` is model-specific
- **Get app and version** at dashboard — reports `BOLOS` + `firmware_version`
- **Open app** (installed) — provisions real Speculos via Speculinho proxy

Explicit `mockClient.addMock` is needed when the spec requires overriding derived behavior (locked device, error sequences, failures).

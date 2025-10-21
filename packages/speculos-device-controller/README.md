# speculos-device-controller

A tiny TypeScript SDK for driving **Speculos** devices:

- **Buttons**: `press(...)`, `left`, `right`, `both`, and `pressSequence([...])`
- **Tap**: **percentage-based** `tapQuick(...)`, `tapLong(...)`
- **Flexible screens config**: use built-in `"flex"`/`"stax"` defaults or supply your own device screen size

---

## Quick start

Out of the box, the API ships with default device screens sizes ("flex" and "stax"). You can use them without passing any options.

```ts
import { deviceControllerClientFactory } from "speculos-device-controller";

const deviceClient = deviceControllerClientFactory("http://localhost:4000");

// Buttons
const deviceButtons = deviceClient.buttonFactory();

await deviceButtons.press("both");
await deviceButtons.left();
await deviceButtons.right();
await deviceButtons.both();
await deviceButtons.pressSequence(["left", "right", "both"], 150);

// Tap: percentages (0..100)
await deviceClient.tapFactory("flex").tapQuick({ x: 20, y: 45 }); // 20% / 45% of the "flex" screen

// You can easily instantiate tap devices dynamically
const currentDeviceTap = deviceClient.tapFactory(currentDevice);
await currentDeviceTap.tapLong({ x: 20, y: 45 });
```

Under the hood, percentages are clamped to [0, 100] and converted to pixels using the screen spec for the selected device key.

### Override default sizes (keep "flex"/"stax" keys)

```ts
const deviceClient = deviceControllerClientFactory("http://localhost:4000", {
  timeoutMs: 2000, // optional axios timeout
  clientHeader: "ldmk-transport-speculos", // optional header
  screens: {
    // override by default keys
    flex: { width: 256, height: 256 },
    // stax: { width: 340, height: 340 }, // you can override one or both
  },
});
```

### Provide custom screens

```ts
const deviceClient = deviceControllerClientFactory("http://localhost:4000", {
  screens: {
    custom: { width: 128, height: 64 },
  },
});

await deviceClient.tapFactory("custom").tapQuick({ x: 50, y: 50 }); // ok
// await deviceClient.tapFactory("unknown").tapQuick({ x: 10, y: 10 }); // throws: Unknown device key "unknown"
```

## API

```ts
type ButtonKey = "left" | "right" | "both";
type Percent = Range<101>; // 0 to 100
type PercentCoordinates = { x: Percent; y: Percent };

type ButtonFactory = () => {
  press(key: ButtonKey): Promise<void>;
  left(): Promise<void>;
  right(): Promise<void>;
  both(): Promise<void>;
  pressSequence(keys: ButtonKey[], delayMs?: number): Promise<void>;
};

type TapFactory = (deviceKey: string) => {
  tapQuick: (point: PercentCoordinates) => Promise<void>;
  tapLong: (point: PercentCoordinates) => Promise<void>;
};

type DeviceControllerClient = {
  buttonFactory: ButtonFactory;
  tapFactory: TapFactory;
};

type DeviceControllerClientFactory = (
  baseURL: string,
  opts?: {
    timeoutMs?: number; // axios timeout (ms)
    clientHeader?: string; // "X-Ledger-Client-Version" header
    screens?: DeviceScreens<string>;
  },
) => DeviceControllerClient;
```

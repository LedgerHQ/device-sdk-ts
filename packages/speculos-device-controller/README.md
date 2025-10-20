# speculos-device-controller

A tiny TypeScript SDK for driving **Speculos** devices:

- **Buttons**: `press(...)`, `left`, `right`, `both`, and `pressSequence([...])`
- **Touch**: **percentage-based** `tapQuick(...)`, `tapLong(...)`
- **Flexible screens config**: use built-in `"flex"`/`"stax"` defaults or supply your own device screen size

---

## Quick start

Out of the box, the API ships with default device screens sizes ("flex" and "stax"). You can use them without passing any options.

```ts
import { deviceControllerFactory } from "speculos-device-controller";

const device = deviceControllerFactory("http://localhost:4000");

// Buttons
await device.button.press("both");
await device.button.left();
await device.button.right();
await device.button.both();
await device.button.pressSequence(["left", "right", "both"], 150);

// Touch: percentages (0..100)
await device.touch.createTap("flex").tapQuick({ x: 20, y: 45 }); // 20% / 45% of the "flex" screen

// Touch returns a factory function so you can easily instantiate devices dynamically
const currentDevice = device.touch.createTap(currentDevice);
await currentDevice.tapLong({ x: 20, y: 45 });
```

Under the hood, percentages are clamped to [0, 100] and converted to pixels using the screen spec for the selected device key.

### Override default sizes (keep "flex"/"stax" keys)

```ts
const device = deviceControllerFactory("http://localhost:4000", {
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
const device = deviceControllerFactory("http://localhost:4000", {
  screens: {
    custom: { width: 128, height: 64 },
  },
});

await device.touch.createTap("custom").tapQuick({ x: 50, y: 50 }); // ok
// await device.touch.createTap("unknown").tapQuick({ x: 10, y: 10 }); // throws: Unknown device key "unknown"
```

## API

### Factory

```ts
deviceControllerFactory(
  baseURL: string,
  opts?: {
    timeoutMs?: number; // axios timeout (ms)
    clientHeader?: string; // "X-Ledger-Client-Version" header
    screens?: Record<string, { width: number; height: number }>;
  }
): DeviceAPI
```

### DeviceAPI

```ts
type ButtonKey = "left" | "right" | "both";
type PercentCoordinates = { x: number; y: number }; // interpreted as 0..100

type ButtonAPI = {
  press(key: ButtonKey): Promise<void>;
  left(): Promise<void>;
  right(): Promise<void>;
  both(): Promise<void>;
  pressSequence(keys: ButtonKey[], delayMs?: number): Promise<void>;
};

type TouchAPI = {
  createTap: (deviceKey: string) => {
    tapQuick: (point: PercentCoordinates) => Promise<void>;
    tapLong: (point: PercentCoordinates, delayMs?: number) => Promise<void>;
  };
};

type DeviceAPI = {
  button: ButtonAPI;
  touch: TouchAPI;
};
```

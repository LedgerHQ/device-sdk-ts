import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Device } from "@ledgerhq/device-mockserver-client";

import {
  appIconUrl,
  OPEN_APP_TIMEOUT_MS,
  openableApps,
  type OpenApp,
  useOpenApp,
} from "./useOpenApp";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("openableApps", () => {
  it("lists the installed apps, without the OS", () => {
    const device = {
      apps: [
        { name: "BOLOS", version: "1.0.0" },
        { name: "Bitcoin", version: "2.5.0" },
      ],
    } as Device;

    expect(openableApps(device)).toEqual([
      { name: "Bitcoin", version: "2.5.0" },
    ]);
  });

  it("lists nothing for a device without apps", () => {
    expect(openableApps({} as Device)).toEqual([]);
  });
});

describe("appIconUrl", () => {
  it("points at Ledger Live's icon for the app", () => {
    expect(appIconUrl("Ethereum Classic")).toBe(
      "https://cdn.live.ledger.com/icons/ethereum_classic.png",
    );
  });
});

describe("useOpenApp", () => {
  let root: Root;
  let result: OpenApp;

  const Probe: React.FC<{ onOpenApp?: (name: string) => Promise<void> }> = ({
    onOpenApp,
  }) => {
    result = useOpenApp(onOpenApp);
    return null;
  };
  const render = (onOpenApp?: (name: string) => Promise<void>) =>
    act(() => root.render(<Probe onOpenApp={onOpenApp} />));
  const open = (name: string) => act(() => result.open(name));
  const wait = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

  beforeEach(() => {
    vi.useFakeTimers();
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("keeps the app as opening once the device accepted it", async () => {
    const onOpenApp = vi.fn(() => Promise.resolve());
    render(onOpenApp);

    open("Bitcoin");
    await wait();

    expect(onOpenApp).toHaveBeenCalledWith("Bitcoin");
    expect(result.opening).toBe("Bitcoin");
    expect(result.error).toBeUndefined();
  });

  it("opens one app at a time", async () => {
    const onOpenApp = vi.fn(() => Promise.resolve());
    render(onOpenApp);

    open("Bitcoin");
    open("Ethereum");
    await wait();

    expect(onOpenApp).toHaveBeenCalledOnce();
  });

  it("says why an app could not be opened", async () => {
    render(() => Promise.reject(new Error("Could not open Bitcoin (6807)")));

    open("Bitcoin");
    await wait();

    expect(result.opening).toBeUndefined();
    expect(result.error).toBe("Could not open Bitcoin (6807)");
  });

  it("gives up when an opened app never shows its screen", async () => {
    render(() => Promise.resolve());

    open("Bitcoin");
    await wait(OPEN_APP_TIMEOUT_MS);

    expect(result.opening).toBeUndefined();
    expect(result.error).toBe("Bitcoin opened but its screen never showed up");
  });

  it("opens nothing without a handler", () => {
    render();

    open("Bitcoin");

    expect(result.opening).toBeUndefined();
  });
});

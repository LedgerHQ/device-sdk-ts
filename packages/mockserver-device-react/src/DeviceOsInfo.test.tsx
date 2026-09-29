import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Device } from "@ledgerhq/device-mockserver-client";

import { findDeviceScreenModel } from "./deviceModels";
import { DeviceOsInfo } from "./DeviceOsInfo";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const aDevice = (apps: { name: string; version: string }[]) =>
  ({ id: "device-1", device_type: "stax", apps }) as unknown as Device;

const APPS = [
  { name: "BOLOS", version: "1.10.1" },
  { name: "Bitcoin", version: "2.5.0" },
  { name: "Ethereum", version: "1.22.3" },
];

describe("DeviceOsInfo", () => {
  let container: HTMLDivElement;
  let root: Root;

  const query = (testId: string) =>
    container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const render = (
    element: React.ReactElement<React.ComponentProps<typeof DeviceOsInfo>>,
  ) => act(() => root.render(element));
  const click = async (testId: string) =>
    act(async () => {
      query(testId)!.click();
      await Promise.resolve();
    });

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("lists the installed apps, without the OS", () => {
    render(
      <DeviceOsInfo
        device={aDevice(APPS)}
        model={findDeviceScreenModel("stax")}
      />,
    );

    expect(query("button_open-app-Bitcoin")).not.toBeNull();
    expect(query("button_open-app-Ethereum")).not.toBeNull();
    expect(query("button_open-app-BOLOS")).toBeNull();
  });

  it("says when no app is installed", () => {
    render(
      <DeviceOsInfo
        device={aDevice([APPS[0]!])}
        model={findDeviceScreenModel("nanoX")}
      />,
    );

    expect(query("list_device-apps")?.textContent).toBe("No apps installed");
  });

  it("cannot open apps without an emulator", () => {
    render(
      <DeviceOsInfo
        device={aDevice(APPS)}
        model={findDeviceScreenModel("nanoS")}
      />,
    );

    expect(
      (query("button_open-app-Bitcoin") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows the app being opened", async () => {
    const onOpenApp = vi.fn(() => new Promise<void>(() => {}));
    render(
      <DeviceOsInfo
        device={aDevice(APPS)}
        model={findDeviceScreenModel("stax")}
        onOpenApp={onOpenApp}
      />,
    );

    await click("button_open-app-Bitcoin");

    expect(onOpenApp).toHaveBeenCalledWith("Bitcoin");
    expect(query("spinner_opening-app-screen")?.textContent).toContain(
      "Opening Bitcoin",
    );
  });

  it("shows why an app could not be opened", async () => {
    render(
      <DeviceOsInfo
        device={aDevice(APPS)}
        model={findDeviceScreenModel("stax")}
        onOpenApp={() => Promise.reject(new Error("Could not open (6d00)"))}
      />,
    );

    await click("button_open-app-Bitcoin");

    expect(query("spinner_opening-app-screen")).toBeNull();
    expect(container.textContent).toContain("Could not open (6d00)");
  });

  it("gives up when an opened app never shows its screen", async () => {
    render(
      <DeviceOsInfo
        device={aDevice(APPS)}
        model={findDeviceScreenModel("stax")}
        onOpenApp={() => Promise.resolve()}
      />,
    );

    await click("button_open-app-Ethereum");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(container.textContent).toContain(
      "Ethereum opened but its screen never showed up",
    );
  });

  it("falls back to the app's initial when its icon is missing", () => {
    render(
      <DeviceOsInfo
        device={aDevice(APPS)}
        model={findDeviceScreenModel("stax")}
      />,
    );

    act(() => {
      query("button_open-app-Bitcoin")!
        .querySelector("img")!
        .dispatchEvent(new Event("error"));
    });

    expect(query("button_open-app-Bitcoin")?.querySelector("img")).toBeNull();
    expect(query("button_open-app-Bitcoin")?.textContent).toBe("BBitcoin");
  });
});

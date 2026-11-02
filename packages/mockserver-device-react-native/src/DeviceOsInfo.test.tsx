import React from "react";
import { type Device } from "@ledgerhq/device-mockserver-client";
import { findDeviceScreenModel } from "@ledgerhq/device-mockserver-react-core";

import { fire, render, wait } from "./__tests__/render";
import { DeviceOsInfo } from "./DeviceOsInfo";

const PALETTE = {
  text: "text",
  mutedText: "muted",
  border: "border",
  button: "button",
  buttonPressed: "pressed",
  error: "error",
};

const aDevice = (names: string[]) =>
  ({
    apps: names.map((name) => ({ name, version: "1.0.0" })),
  }) as unknown as Device;

describe("DeviceOsInfo", () => {
  const info = (
    device: Device,
    onOpenApp?: (name: string) => Promise<void>,
    deviceType = "stax",
  ) =>
    render(
      <DeviceOsInfo
        device={device}
        model={findDeviceScreenModel(deviceType)}
        palette={PALETTE}
        onOpenApp={onOpenApp}
      />,
    );

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the installed apps, without the OS", () => {
    const { queryByTestId } = info(aDevice(["BOLOS", "Bitcoin", "Ethereum"]));

    expect(queryByTestId("button_open-app-Bitcoin")).not.toBeNull();
    expect(queryByTestId("button_open-app-Ethereum")).not.toBeNull();
    expect(queryByTestId("button_open-app-BOLOS")).toBeNull();
  });

  it("says when no app is installed", () => {
    const { byTestId, text } = info(aDevice(["BOLOS"]));

    expect(text(byTestId("list_device-apps"))).toBe("No apps installed");
  });

  it("scrolls a touch screen's apps down and a Nano's across", () => {
    const horizontal = (deviceType: string) =>
      info(aDevice(["Bitcoin"]), undefined, deviceType).allByType(
        "ScrollView",
      )[0]?.props["horizontal"] as boolean;

    expect(horizontal("stax")).toBe(false);
    expect(horizontal("nanoX")).toBe(true);
  });

  it("cannot open apps without a handler", () => {
    const { byTestId } = info(aDevice(["Bitcoin"]));

    expect(byTestId("button_open-app-Bitcoin").props["disabled"]).toBe(true);
  });

  it("covers the list while an app opens", async () => {
    const onOpenApp = vi.fn(() => Promise.resolve());
    const { byTestId, text } = info(
      aDevice(["Bitcoin", "Ethereum"]),
      onOpenApp,
    );

    fire(byTestId("button_open-app-Bitcoin"), "onPress");
    await wait();

    expect(onOpenApp).toHaveBeenCalledWith("Bitcoin");
    expect(text(byTestId("spinner_opening-app-screen"))).toBe(
      "Opening Bitcoin",
    );
    expect(byTestId("button_open-app-Ethereum").props["disabled"]).toBe(true);
  });

  it("shows why an app could not be opened", async () => {
    const { byTestId, queryByTestId, text } = info(aDevice(["Bitcoin"]), () =>
      Promise.reject(new Error("Could not open Bitcoin (6807)")),
    );

    fire(byTestId("button_open-app-Bitcoin"), "onPress");
    await wait();

    expect(queryByTestId("spinner_opening-app-screen")).toBeNull();
    expect(text()).toContain("Could not open Bitcoin (6807)");
  });

  it("falls back to the app's initial when its icon is missing", () => {
    const { allByType, byTestId, text } = info(aDevice(["Bitcoin"]));
    const [icon] = allByType("Image");
    expect(icon?.props["source"]).toEqual({
      uri: "https://cdn.live.ledger.com/icons/bitcoin.png",
    });

    fire(icon!, "onError");

    expect(text(byTestId("button_open-app-Bitcoin"))).toBe("BBitcoin");
  });
});

import React from "react";
import { type Device } from "@ledgerhq/device-mockserver-client";
import {
  type ScreenApi,
  type ScreenPlatform,
} from "@ledgerhq/device-mockserver-react-core";

import { AppState, colorScheme } from "./__mocks__/react-native";
import { fire, invoke, render, wait } from "./__tests__/render";
import { DeviceScreen, type DeviceScreenProps } from "./DeviceScreen";

// jsdom's FileReader reads on real immediates, which fake timers never run.
// The conversion has its own test; here a frame is its source at once.
vi.mock("./nativeScreenPlatform", async (importOriginal) => {
  const { nativeScreenPlatform } = await importOriginal<{
    nativeScreenPlatform: ScreenPlatform;
  }>();
  return {
    nativeScreenPlatform: {
      ...nativeScreenPlatform,
      toImageSource: () => Promise.resolve("data:image/png;base64,cG5n"),
    },
  };
});

const DEVICE = {
  id: "device-1",
  device_type: "stax",
  apps: [{ name: "Bitcoin", version: "2.5.0" }],
} as unknown as Device;

const FRAME = new Blob(["png"], { type: "image/png" });

const anApi = (overrides: Partial<ScreenApi> = {}): ScreenApi => ({
  screenshot: vi.fn(() => Promise.resolve(null)),
  idle: vi.fn(() =>
    Promise.resolve({ kind: "os-info" as const, device: DEVICE }),
  ),
  pressButton: vi.fn(() => Promise.resolve()),
  touch: vi.fn(() => Promise.resolve()),
  openApp: vi.fn(() => Promise.resolve()),
  ...overrides,
});
const live = (overrides: Partial<ScreenApi> = {}) =>
  anApi({ screenshot: vi.fn(() => Promise.resolve(FRAME)), ...overrides });

describe("DeviceScreen", () => {
  const screen = (props: Partial<DeviceScreenProps> = {}) =>
    render(<DeviceScreen api={anApi()} deviceType="stax" {...props} />);

  beforeEach(() => {
    vi.useFakeTimers();
    AppState.currentState = "active";
    colorScheme.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a placeholder until the screen answers", () => {
    const { byTestId } = screen({
      api: anApi({ screenshot: () => new Promise(() => {}) }),
    });

    expect(byTestId("placeholder_device-screen-loading").props).toMatchObject({
      style: [expect.anything(), { backgroundColor: "#FFFFFF" }],
    });
  });

  it("shows the live screen of a running app", async () => {
    const { byTestId } = screen({ api: live() });
    await wait();

    expect(byTestId("image_device-screen").props["source"]).toEqual({
      uri: "data:image/png;base64,cG5n",
    });
  });

  it("shows the installed apps while no app runs", async () => {
    const { queryByTestId } = screen();
    await wait();

    expect(queryByTestId("button_open-app-Bitcoin")).not.toBeNull();
    expect(queryByTestId("banner_device-screen-no-emulator")).toBeNull();
  });

  it("says why a device without an emulator has no screen", async () => {
    const { byTestId } = screen({ deviceType: "nanoS" });
    await wait();

    expect(byTestId("banner_device-screen-no-emulator")).toBeDefined();
    expect(byTestId("button_open-app-Bitcoin").props["disabled"]).toBe(true);
  });

  it("shows why the screen is unavailable", async () => {
    const { byTestId, text } = screen({
      api: anApi({ screenshot: () => Promise.reject(new Error("offline")) }),
    });
    await wait();

    expect(text(byTestId("banner_device-screen-error"))).toContain("offline");
  });

  it("drives a Nano with its buttons", async () => {
    const api = live();
    const { byTestId } = screen({ api, deviceType: "nanoX" });
    await wait();

    const left = byTestId("button_device-screen-left");
    fire(left, "onPressIn");
    fire(left, "onPressOut");

    expect(api.pressButton).toHaveBeenCalledWith("left", "press-and-release");
  });

  it("clicks a Nano button activated by a screen reader", async () => {
    const api = live();
    const { byTestId } = screen({ api, deviceType: "nanoX" });
    await wait();

    const both = byTestId("button_device-screen-both");
    expect(both.props["accessibilityActions"]).toEqual([{ name: "activate" }]);
    fire(both, "onAccessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });

    expect(api.pressButton).toHaveBeenCalledExactlyOnceWith(
      "both",
      "press-and-release",
    );
  });

  it("drives a touch device by its screen, without buttons", async () => {
    const api = live();
    const { byTestId, queryByTestId } = screen({ api });
    await wait();
    expect(queryByTestId("button_device-screen-left")).toBeNull();

    // A Stax's 400x672 screen drawn at half its size.
    const area = byTestId("area_device-screen-touch");
    fire(area, "onLayout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 336 } },
    });
    expect(invoke(area, "onStartShouldSetResponder")).toBe(true);
    fire(area, "onResponderGrant", {
      nativeEvent: { locationX: 50, locationY: 100 },
    });
    fire(area, "onResponderRelease");

    expect(api.touch).toHaveBeenCalledExactlyOnceWith(
      100,
      200,
      "press-and-release",
    );
  });

  it("opens an app from the list", async () => {
    const api = anApi();
    const { byTestId } = screen({ api });
    await wait();

    fire(byTestId("button_open-app-Bitcoin"), "onPress");
    await wait();

    expect(api.openApp).toHaveBeenCalledWith("Bitcoin");
    expect(byTestId("spinner_opening-app-screen")).toBeDefined();
  });

  it("stops polling while the app is in the background", async () => {
    AppState.currentState = "background";
    const api = live();
    screen({ api });
    await wait(5000);
    expect(api.screenshot).not.toHaveBeenCalled();

    AppState.currentState = "active";
    await wait(2000);

    expect(api.screenshot).toHaveBeenCalled();
  });

  it("stops polling once unmounted", async () => {
    const api = live();
    const { unmount } = screen({ api });
    await wait();
    const calls = vi.mocked(api.screenshot).mock.calls.length;

    unmount();
    await wait(5000);

    expect(api.screenshot).toHaveBeenCalledTimes(calls);
  });

  describe("colours", () => {
    const buttonColour = async (props: Partial<DeviceScreenProps>) => {
      const { byTestId } = screen({
        api: live(),
        deviceType: "nanoX",
        ...props,
      });
      await wait();
      const style = byTestId("button_device-screen-left").props[
        "style"
      ] as object[];
      return style[1];
    };

    it("follows the system's scheme", async () => {
      colorScheme.current = "dark";

      expect(await buttonColour({})).toMatchObject({
        backgroundColor: "#242424",
      });
    });

    it("takes the host's scheme over the system's", async () => {
      colorScheme.current = "dark";

      expect(await buttonColour({ colorScheme: "light" })).toMatchObject({
        backgroundColor: "#F2F2F2",
      });
    });
  });
});

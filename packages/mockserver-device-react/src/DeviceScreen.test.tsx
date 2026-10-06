import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Device } from "@ledgerhq/device-mockserver-client";

import { DeviceScreen, type DeviceScreenProps } from "./DeviceScreen";
import { type ScreenApi } from "./types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const DEVICE = {
  id: "device-1",
  device_type: "stax",
  apps: [{ name: "Bitcoin", version: "2.5.0" }],
} as unknown as Device;

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

describe("DeviceScreen", () => {
  let container: HTMLDivElement;
  let root: Root;

  const query = (testId: string) =>
    container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const render = (props: Partial<DeviceScreenProps> & { api: ScreenApi }) =>
    act(() => root.render(<DeviceScreen deviceType="stax" {...props} />));
  const wait = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
  const pointer = (target: Element, type: string, init: MouseEventInit = {}) =>
    act(() => {
      target.dispatchEvent(
        new MouseEvent(type, { bubbles: true, button: 0, ...init }),
      );
    });

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => "blob:frame");
    URL.revokeObjectURL = vi.fn();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  describe("inline", () => {
    it("shows a placeholder until the screen answers", () => {
      render({ api: anApi({ screenshot: () => new Promise(() => {}) }) });

      expect(query("placeholder_device-screen-loading")).not.toBeNull();
    });

    it("shows the live screen of a running app", async () => {
      render({
        api: anApi({ screenshot: () => Promise.resolve(new Blob(["png"])) }),
      });
      await wait();

      expect(query("image_device-screen")?.getAttribute("src")).toBe(
        "blob:frame",
      );
    });

    it("shows the installed apps while no app runs", async () => {
      render({ api: anApi() });
      await wait();

      expect(query("button_open-app-Bitcoin")).not.toBeNull();
    });

    it("says why a device without an emulator has no screen", async () => {
      render({ api: anApi(), deviceType: "nanoS" });
      await wait();

      expect(query("button_open-app-Bitcoin")).not.toBeNull();
      expect(container.textContent).toContain(
        "Speculos has no emulator for the Nano S",
      );
    });

    it("says nothing about emulators for a device that has one", async () => {
      render({ api: anApi() });
      await wait();

      expect(container.textContent).not.toContain("has no emulator");
    });

    it("says there is no screen when the api has nothing to show instead", async () => {
      render({ api: anApi({ idle: undefined }) });
      await wait();

      expect(container.textContent).toContain("No screen to capture");
    });

    it("shows why the screen is unavailable", async () => {
      render({
        api: anApi({ screenshot: () => Promise.reject(new Error("offline")) }),
      });
      await wait();

      expect(container.textContent).toContain("Screen unavailable");
      expect(container.textContent).toContain("offline");
    });

    it("keeps the last frame through a few failures while live", async () => {
      const screenshot = vi
        .fn<() => Promise<Blob | null>>()
        .mockResolvedValueOnce(new Blob(["png"]))
        .mockRejectedValue(new Error("app quitting"));
      const failures = () => screenshot.mock.calls.length - 1;
      render({ api: anApi({ screenshot }) });
      await wait();

      while (failures() < 3) await wait(500);
      expect(query("image_device-screen")).not.toBeNull();

      while (failures() < 4) await wait(500);
      expect(query("image_device-screen")).toBeNull();
      expect(container.textContent).toContain("app quitting");
    });

    it("drives a Nano with its buttons and refreshes after", async () => {
      const api = anApi({
        screenshot: vi.fn(() => Promise.resolve(new Blob(["png"]))),
      });
      render({ api, deviceType: "nanoX" });
      await wait();

      pointer(query("button_device-screen-left")!, "pointerdown");
      pointer(query("button_device-screen-left")!, "pointerup");
      await wait();

      expect(api.pressButton).toHaveBeenCalledWith("left", "press-and-release");
      expect(api.screenshot).toHaveBeenCalledTimes(2);
    });

    it("drives a touch device by its screen, without buttons", async () => {
      render({
        api: anApi({ screenshot: () => Promise.resolve(new Blob(["png"])) }),
      });
      await wait();

      expect(query("image_device-screen")).not.toBeNull();
      expect(query("button_device-screen-left")).toBeNull();
    });
  });

  describe("floating", () => {
    const windowElement = () => query("container_device-screen")!;
    const header = () => windowElement().firstElementChild!;

    it("titles the window with the model and firmware", async () => {
      render({ api: anApi(), floating: true, firmwareVersion: "1.10.1" });
      await wait();

      expect(windowElement().textContent).toContain("Stax - 1.10.1");
      expect(windowElement().style.width).toBe("224px");
    });

    it("stops polling while collapsed", async () => {
      const api = anApi();
      render({ api, floating: true, defaultCollapsed: true });
      await wait(5000);

      expect(api.screenshot).not.toHaveBeenCalled();
      expect(query("button_open-app-Bitcoin")).toBeNull();

      act(() => query("button_toggle-device-screen")!.click());
      await wait();

      expect(api.screenshot).toHaveBeenCalled();
      expect(query("button_open-app-Bitcoin")).not.toBeNull();
    });

    it("is dragged by its header", async () => {
      render({ api: anApi(), floating: true });
      await wait();

      pointer(header(), "pointerdown", { clientX: 10, clientY: 10 });
      pointer(header(), "pointermove", { clientX: 110, clientY: 60 });
      pointer(header(), "pointerup");
      pointer(header(), "pointermove", { clientX: 500, clientY: 500 });

      expect(windowElement().style.left).toBe("100px");
      expect(windowElement().style.top).toBe("50px");
    });

    describe("when the viewport shrinks", () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const resizeViewport = (width: number, height: number) =>
        act(() => {
          Object.assign(window, { innerWidth: width, innerHeight: height });
          window.dispatchEvent(new Event("resize"));
        });

      afterEach(() => {
        Object.assign(window, {
          innerWidth: viewport.width,
          innerHeight: viewport.height,
        });
      });

      it("pulls a dragged window back on screen", async () => {
        render({ api: anApi(), floating: true });
        await wait();
        windowElement().getBoundingClientRect = () =>
          ({ left: 0, top: 0, width: 224, height: 300 }) as DOMRect;
        pointer(header(), "pointerdown", { clientX: 10, clientY: 10 });
        pointer(header(), "pointermove", { clientX: 610, clientY: 410 });
        pointer(header(), "pointerup");
        expect(windowElement().style.left).toBe("600px");

        resizeViewport(500, 500);

        expect(windowElement().style.left).toBe("276px");
        expect(windowElement().style.top).toBe("200px");
      });

      it("leaves a window that was never moved in its corner", async () => {
        render({ api: anApi(), floating: true });
        await wait();

        resizeViewport(500, 500);

        expect(windowElement().style.left).toBe("");
        expect(windowElement().style.right).toBe("16px");
      });
    });

    it("is not dragged from its button or with another mouse button", async () => {
      render({ api: anApi(), floating: true });
      await wait();

      pointer(query("button_toggle-device-screen")!, "pointerdown");
      pointer(header(), "pointerdown", { button: 2 });
      pointer(header(), "pointermove", { clientX: 110, clientY: 60 });

      expect(windowElement().style.left).toBe("");
    });

    it("is resized from its edge, down to a minimum width", async () => {
      render({ api: anApi(), floating: true });
      await wait();
      windowElement().getBoundingClientRect = () =>
        ({ left: 100, top: 80, width: 224, height: 300 }) as DOMRect;
      const handle = query("handle_resize-device-screen")!;

      pointer(handle, "pointerdown", { clientX: 324 });
      pointer(handle, "pointermove", { clientX: 424 });
      expect(windowElement().style.width).toBe("324px");
      expect(windowElement().style.left).toBe("100px");

      pointer(handle, "pointermove", { clientX: 0 });
      pointer(handle, "pointerup");
      pointer(handle, "pointermove", { clientX: 600 });
      expect(windowElement().style.width).toBe("200px");
    });
  });
});

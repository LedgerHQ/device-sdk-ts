import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MockClient } from "@ledgerhq/device-mockserver-client";

import { MockServerDevice } from "./MockServerDevice";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@ledgerhq/device-mockserver-client", () => ({
  MockClient: vi.fn(),
}));

describe("MockServerDevice", () => {
  let container: HTMLDivElement;
  let root: Root;
  const getDevice = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    getDevice.mockReset();
    vi.mocked(MockClient).mockImplementation(
      () =>
        ({
          getDevice,
          getScreenshot: () => new Promise(() => {}),
        }) as unknown as MockClient,
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = () =>
    act(() =>
      root.render(
        <MockServerDevice
          url="http://mock"
          token="session-token"
          deviceId="device-1"
          floating
        />,
      ),
    );

  it("renders nothing until the device's model is known", () => {
    getDevice.mockReturnValue(new Promise(() => {}));

    render();

    expect(container.childElementCount).toBe(0);
  });

  it("shows the device's screen in its session", async () => {
    getDevice.mockResolvedValue({
      id: "device-1",
      device_type: "flex",
      firmware_version: "1.6.1",
    });

    render();
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(MockClient).toHaveBeenCalledWith("http://mock", {
      token: "session-token",
    });
    expect(getDevice).toHaveBeenCalledWith("device-1");
    expect(container.textContent).toContain("Flex - 1.6.1");
  });

  it("still shows the screen when the device cannot be read", async () => {
    getDevice.mockRejectedValue(new Error("offline"));

    render();
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(
      container.querySelector('[data-testid="container_device-screen"]'),
    ).not.toBeNull();
  });
});

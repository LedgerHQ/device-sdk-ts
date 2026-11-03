import React from "react";
import { MockClient } from "@ledgerhq/device-mockserver-client";

import { render, wait } from "./__tests__/render";
import { MockServerDevice } from "./MockServerDevice";

vi.mock("@ledgerhq/device-mockserver-client", () => ({
  MockClient: vi.fn(),
}));

describe("MockServerDevice", () => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const device = () =>
    render(
      <MockServerDevice
        url="http://mock"
        token="session-token"
        deviceId="device-1"
      />,
    );

  it("renders nothing until the device's model is known", () => {
    getDevice.mockReturnValue(new Promise(() => {}));

    const { renderer } = device();

    expect(renderer.toJSON()).toBeNull();
  });

  it("shows the device's screen in its session", async () => {
    getDevice.mockResolvedValue({ id: "device-1", device_type: "nanoX" });

    const { byTestId } = device();
    await wait();

    expect(MockClient).toHaveBeenCalledWith("http://mock", {
      token: "session-token",
    });
    expect(getDevice).toHaveBeenCalledWith("device-1");
    // A Nano's screen is twice as wide as it is tall.
    expect(byTestId("placeholder_device-screen-loading").props).toMatchObject({
      style: [expect.anything(), { aspectRatio: 2 }],
    });
  });

  it("still shows the screen when the device cannot be read", async () => {
    getDevice.mockRejectedValue(new Error("offline"));

    const { queryByTestId } = device();
    await wait();

    expect(queryByTestId("container_device-screen")).not.toBeNull();
  });
});

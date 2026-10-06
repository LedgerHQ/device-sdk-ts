import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Device } from "@ledgerhq/device-mockserver-client";

import { type MockServerClient } from "./types";
import { useMockServerDevice } from "./useMockServerDevice";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const DEVICE = { id: "device-1", device_type: "stax" } as Device;

describe("useMockServerDevice", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: Device | null | undefined;

  const Probe: React.FC<{ client: MockServerClient; deviceId: string }> = ({
    client,
    deviceId,
  }) => {
    result = useMockServerDevice(client, deviceId);
    return null;
  };
  const aClient = (getDevice: () => Promise<Device>) =>
    ({ getDevice: vi.fn(getDevice) }) as unknown as MockServerClient;
  const render = (client: MockServerClient, deviceId = "device-1") =>
    act(() => root.render(<Probe client={client} deviceId={deviceId} />));
  const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

  beforeEach(() => {
    vi.useFakeTimers();
    result = undefined;
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("reads the device record", async () => {
    const client = aClient(() => Promise.resolve(DEVICE));

    render(client);
    expect(result).toBeUndefined();
    await flush();

    expect(result).toBe(DEVICE);
    expect(client.getDevice).toHaveBeenCalledWith("device-1");
  });

  it("accepts a client from another copy of the package", async () => {
    // Its own private field, as a MockClient from a second install would have:
    // only the public calls must match.
    class OtherCopyClient implements MockServerClient {
      private readonly record = DEVICE;
      getDevice = vi.fn(() => Promise.resolve(this.record));
      getScreenshot = vi.fn<MockServerClient["getScreenshot"]>();
      pressButton = vi.fn<MockServerClient["pressButton"]>();
      touchScreen = vi.fn<MockServerClient["touchScreen"]>();
      sendApdu = vi.fn<MockServerClient["sendApdu"]>();
    }
    const client = new OtherCopyClient();

    render(client);
    await flush();

    expect(result).toBe(DEVICE);
  });

  it("reads nothing without a device id", async () => {
    const client = aClient(() => Promise.resolve(DEVICE));

    render(client, "");
    await flush();

    expect(result).toBeUndefined();
    expect(client.getDevice).not.toHaveBeenCalled();
  });

  it("retries a failed read until it succeeds", async () => {
    const getDevice = vi
      .fn<() => Promise<Device>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(DEVICE);
    const client = aClient(getDevice);

    render(client);
    await flush();
    expect(result).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(2000));

    expect(result).toBe(DEVICE);
    expect(getDevice).toHaveBeenCalledTimes(2);
  });

  it("stops retrying once unmounted", async () => {
    const client = aClient(() => Promise.reject(new Error("offline")));

    render(client);
    await flush();
    act(() => root.render(<></>));
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(client.getDevice).toHaveBeenCalledOnce();
  });
});

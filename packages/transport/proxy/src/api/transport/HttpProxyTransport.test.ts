/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  TransportConnectedDevice,
  TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import {
  GeneralDmkError,
  OpeningConnectionError,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpProxyDataSource } from "@api/data/HttpProxyDataSource";

import {
  HttpProxyTransport,
  speculosProxyHttpIdentifier,
} from "./HttpProxyTransport";

class LoggerStub {
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
  debug = vi.fn();
  tag = "";
  subscribers: any[] = [];
}
const loggerFactory = () => new LoggerStub();
const config = {} as any;

describe("HttpProxyTransport", () => {
  let transport: HttpProxyTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => [],
    } as any);
    transport = new HttpProxyTransport(loggerFactory, config, "http://test");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isSupported returns true", () => {
    expect(transport.isSupported()).toBe(true);
  });

  it("getIdentifier returns the correct identifier", () => {
    expect(transport.getIdentifier()).toBe(speculosProxyHttpIdentifier);
  });

  it("listenToAvailableDevices starts empty", async () => {
    await new Promise<void>((resolve) => {
      transport.listenToAvailableDevices().subscribe((devices) => {
        expect(devices).toEqual([]);
        resolve();
      });
    });
  });

  it("startDiscovering emits added devices and stopDiscovering unsubscribes", async () => {
    // given
    const rawDevices = [
      { id: "dev1", deviceModel: { blockSize: 32, masks: [], memorySize: 0 } },
    ];
    (global.fetch as any)
      .mockResolvedValueOnce({ json: async () => rawDevices } as any)
      .mockResolvedValue({ json: async () => rawDevices } as any);
    const added: TransportDiscoveredDevice[] = [];

    // when
    transport.startDiscovering().subscribe((dev) => added.push(dev));

    // then
    await vi.advanceTimersByTimeAsync(0);
    expect(added).toHaveLength(1);
    expect(added[0]!.id).toBe("http://test#dev1");

    added.length = 0;
    await vi.advanceTimersByTimeAsync(5000);
    expect(added).toHaveLength(0);

    transport.stopDiscovering();
    await vi.advanceTimersByTimeAsync(5000);
    expect(added).toHaveLength(0);
  });

  it("connect returns Left<UnknownDeviceError> for invalid URL", async () => {
    // given
    const result = await transport.connect({
      deviceId: "http://wrong#dev",
      onDisconnect: vi.fn(),
    });

    // then
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => {
      expect(err).toBeInstanceOf(UnknownDeviceError);
    });
  });

  it("connect returns Left<UnknownDeviceError> for unseen device", async () => {
    // given
    const result = await transport.connect({
      deviceId: "http://test#nope",
      onDisconnect: vi.fn(),
    });

    // then
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => {
      expect(err).toBeInstanceOf(UnknownDeviceError);
    });
  });

  it("connect returns Left<OpeningConnectionError> on handshake failure", async () => {
    // given
    const deviceId = "http://test#dev";
    (transport as any).seenDevices.set(deviceId, {
      id: deviceId,
      deviceModel: { blockSize: 64, masks: [], memorySize: 0 },
      transport: speculosProxyHttpIdentifier,
    });
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockRejectedValue(
      new Error("fail"),
    );

    // when
    const result = await transport.connect({ deviceId, onDisconnect: vi.fn() });

    // then
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => {
      expect(err).toBeInstanceOf(OpeningConnectionError);
    });
  });

  it("connect returns Right<TransportConnectedDevice> with correct productName on success", async () => {
    // given
    const deviceId = "http://test#dev";
    const baseDevice = {
      id: deviceId,
      deviceModel: { blockSize: 16, masks: [], memorySize: 0 },
      transport: speculosProxyHttpIdentifier,
    };
    (transport as any).seenDevices.set(deviceId, baseDevice);
    const name = "app";
    const version = "v1";
    const encoder = new TextEncoder();
    const toHex = (arr: Uint8Array) =>
      Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const nameHex = toHex(encoder.encode(name));
    const versionHex = toHex(encoder.encode(version));
    const nameLen = (nameHex.length / 2).toString(16).padStart(2, "0");
    const versionLen = (versionHex.length / 2).toString(16).padStart(2, "0");
    const handshake = `01${nameLen}${nameHex}${versionLen}${versionHex}9000`;
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockResolvedValueOnce(
      handshake,
    );

    // when
    const result = await transport.connect({ deviceId, onDisconnect: vi.fn() });

    // then
    expect(result.isRight()).toBe(true);
    result.ifRight((dev: TransportConnectedDevice) => {
      expect(dev.deviceModel.productName).toBe(`Proxy – ${name} – ${version}`);
      expect(typeof dev.sendApdu).toBe("function");
    });
  });

  it("sendApdu returns Right<ApduResponse> on success", async () => {
    // given
    const deviceId = "http://test#dev";
    (transport as any).activeDeviceConnection = { id: deviceId } as any;
    const dataHex = "f0cacc1a";
    const statusHex = "9000";
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockResolvedValue(
      dataHex + statusHex,
    );
    const onDisconnect = vi.fn();

    // when
    const result = await (transport as any).sendApdu(
      new Uint8Array([0x01]),
      onDisconnect,
    );

    // then
    expect(result.isRight()).toBe(true);
    result.ifRight(
      ({ data, statusCode }: { data: Uint8Array; statusCode: Uint8Array }) => {
        const toHex = (arr: Uint8Array) =>
          Array.from(arr)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        expect(toHex(data)).toBe(dataHex);
        expect(toHex(statusCode)).toBe(statusHex);
      },
    );
  });

  it("sendApdu on error triggers onDisconnect and clears activeDeviceConnection", async () => {
    // given
    const deviceId = "http://test#dev";
    const onDisconnect = vi.fn();
    (transport as any).activeDeviceConnection = { id: deviceId } as any;
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockRejectedValue(
      new Error("err"),
    );

    // when
    const result = await (transport as any).sendApdu(
      new Uint8Array([0xff]),
      onDisconnect,
    );

    // then
    expect(onDisconnect).toHaveBeenCalledWith(deviceId);
    expect((transport as any).activeDeviceConnection).toBeNull();
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err: GeneralDmkError): void =>
      expect(err).toBeInstanceOf(GeneralDmkError),
    );
  });

  it("disconnect closes dataSource and clears activeDeviceConnection", async () => {
    // given
    const deviceId = "http://test#dev";
    (transport as any).activeDeviceConnection = { id: deviceId } as any;
    const spyClose = vi.spyOn(HttpProxyDataSource.prototype, "close");

    // when
    const res = await transport.disconnect({
      connectedDevice: { id: deviceId } as any,
    });

    // then
    expect(res.isRight()).toBe(true);
    expect((transport as any).activeDeviceConnection).toBeNull();
    expect(spyClose).toHaveBeenCalled();
  });
});

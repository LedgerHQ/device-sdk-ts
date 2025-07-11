/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DisconnectHandler,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
  GeneralDmkError,
  OpeningConnectionError,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { firstValueFrom } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type RawData } from "ws";

import { type WebSocketProxyDataSourceInstance } from "@api/data/WebsocketProxyDataSource";

import {
  speculosProxyWsIdentifier,
  WsProxyTransport,
} from "./WebsocketProxyTransport";

class LoggerStub implements LoggerPublisherService {
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
  debug = vi.fn();
  tag = "";
  subscribers: any[] = [];
}

class MockWebSocket {
  public readyState = 0;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  private listeners: Record<string, ((...args: any[]) => void)[]> = {};
  constructor(public url: string) {}

  send = vi.fn();
  close = vi.fn();

  // node-style
  on(event: string, cb: (...args: any[]) => void): void {
    (this.listeners[event] ||= []).push(cb);
  }
  off(event: string, cb: (...args: any[]) => void) {
    this.listeners[event] = (this.listeners[event] || []).filter(
      (fn) => fn !== cb,
    );
  }

  // browser-style
  addEventListener(event: string, cb: any) {
    return this.on(event, cb);
  }
  removeEventListener(event: string, cb: any) {
    return this.off(event, cb);
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    (this.listeners["open"] || []).forEach((cb) => cb());
  }
  emitError(err: any = new Error("socket error")) {
    (this.listeners["error"] || []).forEach((cb) => cb(err));
  }
  emitMessage(data: RawData | string) {
    (this.listeners["message"] || []).forEach((cb) => cb(data));
  }
  emitClose() {
    this.readyState = MockWebSocket.CLOSED;
    (this.listeners["close"] || []).forEach((cb) => cb());
  }
}

const loggerFactory = () => new LoggerStub();
const config = {} as any;
const wsUrl = "ws://test";

describe("WsProxyTransport", () => {
  let transport: WsProxyTransport;
  let OriginalWebSocket: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as any;
    transport = new WsProxyTransport(loggerFactory, config, wsUrl);
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("isSupported returns true", () => {
    expect(transport.isSupported()).toBe(true);
  });

  it("getIdentifier returns the correct identifier", () => {
    expect(transport.getIdentifier()).toBe(speculosProxyWsIdentifier);
  });

  it("listenToAvailableDevices emits an array containing the base device", async () => {
    const devices = await firstValueFrom(transport.listenToAvailableDevices());
    expect(devices).toHaveLength(1);
    expect(devices[0]!.id).toBe(wsUrl);
    expect(devices[0]!.transport).toBe(speculosProxyWsIdentifier);
  });

  it("startDiscovering emits the base device", async () => {
    const device = await firstValueFrom(transport.startDiscovering());
    expect(device.id).toBe(wsUrl);
    expect(device.transport).toBe(speculosProxyWsIdentifier);
  });

  it("stopDiscovering logs a debug message", () => {
    const logger = loggerFactory() as LoggerStub;
    const t = new WsProxyTransport(() => logger, config, wsUrl);
    t.stopDiscovering();
    expect(logger.debug).toHaveBeenCalledWith("stopDiscovering");
  });

  it("connect returns Left<UnknownDeviceError> for unknown deviceId", async () => {
    const result = await transport.connect({
      deviceId: "ws://wrong",
      onDisconnect: vi.fn(),
    });
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => {
      expect(err).toBeInstanceOf(UnknownDeviceError);
    });
  });

  it("connect returns Left<OpeningConnectionError> if ensureOpen fails", async () => {
    vi.spyOn((transport as any).ds, "ensureOpen").mockRejectedValue(
      new Error("boom"),
    );
    const result = await transport.connect({
      deviceId: wsUrl,
      onDisconnect: vi.fn(),
    });
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => {
      expect(err).toBeInstanceOf(OpeningConnectionError);
    });
  });

  it("connect returns Right<TransportConnectedDevice> on successful handshake", async () => {
    // given
    const ds = (transport as any).ds as WebSocketProxyDataSourceInstance;
    vi.spyOn(ds, "ensureOpen").mockResolvedValue(undefined);
    vi.spyOn(ds, "waitForOpened").mockResolvedValue(undefined);
    const wsSend = vi.spyOn(ds.ws, "send");

    // when
    const result = await transport.connect({
      deviceId: wsUrl,
      onDisconnect: vi.fn(),
    });

    // then
    expect(result.isRight()).toBe(true);
    result.ifRight((dev) => {
      expect(dev.id).toBe(wsUrl);
      expect(dev.transport).toBe(speculosProxyWsIdentifier);
      expect(dev.type).toBe("USB");
      expect(typeof dev.sendApdu).toBe("function");
      expect(wsSend).toHaveBeenCalledWith("open");
    });
  });

  it("sendApdu returns Right<ApduResponse> on success", async () => {
    // given
    const ds = (transport as any).ds as WebSocketProxyDataSourceInstance;
    const dataHex = "f0cacc1a";
    const statusHex = "9000";
    vi.spyOn(ds, "postAdpu").mockResolvedValue(dataHex + statusHex);

    const onDisconnect: DisconnectHandler = vi.fn();

    // when
    const result = await (transport as any).sendApdu(
      Uint8Array.from([0x01, 0x02]),
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

  it("sendApdu returns Right<ApduResponse> on success empty response", async () => {
    // given
    const ds = (transport as any).ds as WebSocketProxyDataSourceInstance;
    const dataHex = "";
    const statusHex = "9000";
    vi.spyOn(ds, "postAdpu").mockResolvedValue(dataHex + statusHex);

    const onDisconnect: DisconnectHandler = vi.fn();

    // when
    const result = await (transport as any).sendApdu(
      Uint8Array.from([0x01, 0x02]),
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

  it("sendApdu on error triggers onDisconnect and returns Left<GeneralDmkError>", async () => {
    // given
    const ds = (transport as any).ds as WebSocketProxyDataSourceInstance;
    vi.spyOn(ds, "postAdpu").mockRejectedValue(new Error("boom"));
    const closeSpy = vi.spyOn(ds, "close");
    const onDisconnect: DisconnectHandler = vi.fn();

    // when
    const result = await (transport as any).sendApdu(
      Uint8Array.of(0xff),
      onDisconnect,
    );

    // then
    expect(onDisconnect).toHaveBeenCalledWith(wsUrl);
    expect(closeSpy).toHaveBeenCalled();
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err: GeneralDmkError): void => {
      expect(err).toBeInstanceOf(GeneralDmkError);
    });
  });

  it("disconnect closes the data source and returns Right<void>", async () => {
    // given
    const ds = (transport as any).ds as WebSocketProxyDataSourceInstance;
    const closeSpy = vi.spyOn(ds, "close");

    // when
    const result = await transport.disconnect();

    // then
    expect(result.isRight()).toBe(true);
    result.ifRight((v) => {
      expect(v).toBeUndefined();
    });
    expect(closeSpy).toHaveBeenCalled();
  });
});

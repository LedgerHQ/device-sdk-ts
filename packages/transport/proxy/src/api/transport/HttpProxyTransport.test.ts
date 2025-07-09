/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ApduResponse,
  GeneralDmkError,
  type LoggerPublisherService,
  type LoggerSubscriberService,
  OpeningConnectionError,
  type TransportArgs,
  type TransportConnectedDevice,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom } from "rxjs";

import { HttpProxyDataSource } from "@api/data/HttpProxyDataSource";
import {
  HttpProxyTransport,
  speculosIdentifier,
  speculosTransportFactory,
} from "@api/transport/HttpProxyTransport";

class LoggerPublisherServiceStub implements LoggerPublisherService {
  constructor(subscribers: LoggerSubscriberService[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }
  subscribers: LoggerSubscriberService[] = [];
  tag: string = "";
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
  debug = vi.fn();
}

describe("HttpProxyTransport", () => {
  const logger = new LoggerPublisherServiceStub([], "proxy");
  let loggerFactory: (tag: string) => typeof logger;
  const config = {} as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    loggerFactory = () => logger;
  });

  it("isSupported should return true", () => {
    // given
    const transport = new HttpProxyTransport(
      loggerFactory,
      config,
      "http://test",
    );

    // then
    expect(transport.isSupported()).toBe(true);
  });

  it("getIdentifier should return speculosIdentifier", () => {
    // given
    const transport = new HttpProxyTransport(
      loggerFactory,
      config,
      "http://test",
    );

    // then
    expect(transport.getIdentifier()).toBe(speculosIdentifier);
  });

  it("listenToAvailableDevices emits a device with dynamic id", async () => {
    // given
    const t1 = new HttpProxyTransport(loggerFactory, config, "http://a");
    const t2 = new HttpProxyTransport(loggerFactory, config, "http://b");
    const d1 = (await lastValueFrom(t1.listenToAvailableDevices())) || [];
    const d2 = (await lastValueFrom(t2.listenToAvailableDevices())) || [];

    // then
    expect(d1[0]!.id).not.toBe(d2[0]!.id);
    expect(d1[0]!.transport).toBe(speculosIdentifier);
  });

  it("connect returns Left on handshake failure", async () => {
    // given
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockRejectedValue(
      new Error("meh"),
    );
    const transport = new HttpProxyTransport(
      loggerFactory,
      config,
      "http://test",
    );

    // when
    const result = await transport.connect({
      deviceId: "dev1",
      onDisconnect: vi.fn(),
    });

    // then
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => {
      expect(err).toBeInstanceOf(OpeningConnectionError);
    });
  });

  it("connect returns Right with correct productName on handshake success", async () => {
    // given
    const name = "app";
    const version = "1.2.3";
    const nameHex = Buffer.from(name).toString("hex");
    const versionHex = Buffer.from(version).toString("hex");
    const handshakeHex = `03${nameHex}05${versionHex}9000`;
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockResolvedValueOnce(
      handshakeHex,
    );

    const transport = new HttpProxyTransport(
      loggerFactory,
      config,
      "http://test",
    );

    // when
    const result = await transport.connect({
      deviceId: "dev1",
      onDisconnect: vi.fn(),
    });

    // then
    expect(result.isRight()).toBe(true);
    const dev = result.extract() as TransportConnectedDevice;
    expect(dev.deviceModel.productName).toBe(`Speculos - ${name} - ${version}`);
    expect(dev.id).toMatch(/^Speculos-/);
    expect(typeof dev.sendApdu).toBe("function");
  });

  it("sendApdu returns Right on success", async () => {
    // given
    const transport = new HttpProxyTransport(
      loggerFactory,
      config,
      "http://test",
    );
    (transport as any).connectedDevice = {
      id: "dummy",
      transport: "",
      deviceModel: {} as any,
      type: "USB",
    };
    const dataHex = "f0cacc1a";
    const statusHex = "9000";
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockResolvedValue(
      `${dataHex}${statusHex}`,
    );
    const apdu = new Uint8Array([0x00]);

    // when
    const result = await transport.sendApdu("sess", "dev1", vi.fn(), apdu);

    // then
    expect(result.isRight()).toBe(true);
    const { data, statusCode } = result.extract() as ApduResponse;
    expect(Array.from(data)).toEqual([0xf0, 0xca, 0xcc, 0x1a]);
    expect(Array.from(statusCode)).toEqual([0x90, 0x00]);
  });

  it("sendApdu returns Left and calls onDisconnect on failure", async () => {
    // given
    const transport = new HttpProxyTransport(
      loggerFactory,
      config,
      "http://test",
    );
    (transport as any).connectedDevice = {
      id: "x",
      transport: "",
      deviceModel: {} as any,
      type: "USB",
    };
    vi.spyOn(HttpProxyDataSource.prototype, "postAdpu").mockRejectedValue(
      new Error("err"),
    );
    const onDisconnect = vi.fn();

    // when
    const result = await transport.sendApdu(
      "sess",
      "dev1",
      onDisconnect,
      new Uint8Array(),
    );

    // then
    expect(onDisconnect).toHaveBeenCalledWith("dev1");
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => {
      expect(err).toBeInstanceOf(GeneralDmkError);
    });
  });

  it("disconnect clears connectedDevice", async () => {
    // given
    const transport = new HttpProxyTransport(
      loggerFactory,
      config,
      "http://test",
    );
    (transport as any).connectedDevice = {} as any;

    // when
    const result = await transport.disconnect({ connectedDevice: {} as any });

    // then
    expect(result.isRight()).toBe(true);
    expect((transport as any).connectedDevice).toBeNull();
  });

  it("speculosTransportFactory creates transport with given URL", () => {
    // given
    const factory = speculosTransportFactory("http://xyz");
    const transport = factory({
      config,
      loggerServiceFactory: loggerFactory,
    } as unknown as TransportArgs);

    // then
    expect(transport.isSupported()).toBe(true);
    expect(transport.getIdentifier()).toBe(speculosIdentifier);
  });
});

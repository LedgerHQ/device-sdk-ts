import {
  DeviceModelId,
  DisconnectError,
  type LoggerPublisherService,
  LogLevel,
  type LogParams,
  OpeningConnectionError,
  StaticDeviceModelDataSource,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts/Either";
import { Subject } from "rxjs";

import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";

import { SendApduError } from "./Errors";
import { type NativeModuleWrapper } from "./NativeModuleWrapper";
import { RNHidTransport } from "./RNHidTransport";
import { type InternalDeviceDisconnected } from "./types";

const deviceModelDataSource = new StaticDeviceModelDataSource();

const makeMockTransportDiscoveredDevice = (
  id: string,
  deviceModelId: DeviceModelId,
): TransportDiscoveredDevice => ({
  id,
  transport: TRANSPORT_IDENTIFIER,
  name: deviceModelId,
  deviceModel: deviceModelDataSource.getDeviceModel({
    id: deviceModelId,
  }),
});

const mockDiscoveredDevice1 = makeMockTransportDiscoveredDevice(
  "1",
  DeviceModelId.NANO_S,
);
const mockDiscoveredDevice2 = makeMockTransportDiscoveredDevice(
  "2",
  DeviceModelId.NANO_X,
);
const mockDiscoveredDevice3 = makeMockTransportDiscoveredDevice(
  "3",
  DeviceModelId.NANO_S,
);

describe("RNHidTransport", () => {
  let discoveredDevicesSubject: Subject<Array<TransportDiscoveredDevice>>;
  let deviceDisconnectedSubject: Subject<InternalDeviceDisconnected>;
  let transportLogsSubject: Subject<LogParams>;
  let nativeModuleWrapper: NativeModuleWrapper;
  const fakeLogger: LoggerPublisherService = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    subscribers: [],
  };
  const loggerServiceFactory = jest.fn(() => fakeLogger);

  const wrapperStartScan = jest.fn();
  const wrapperStopScan = jest.fn();
  const wrapperConnectDevice = jest.fn();
  const wrapperDisconnectDevice = jest.fn();
  const wrapperSendApdu = jest.fn();

  beforeEach(() => {
    discoveredDevicesSubject = new Subject();
    deviceDisconnectedSubject = new Subject();
    transportLogsSubject = new Subject();

    jest.clearAllMocks();

    wrapperStartScan.mockResolvedValue(undefined);
    wrapperStopScan.mockResolvedValue(undefined);
    wrapperConnectDevice.mockResolvedValue(undefined);
    wrapperDisconnectDevice.mockResolvedValue(undefined);
    wrapperSendApdu.mockResolvedValue(undefined);

    nativeModuleWrapper = {
      startScan: wrapperStartScan,
      stopScan: wrapperStopScan,
      subscribeToDiscoveredDevicesEvents: jest.fn(() =>
        discoveredDevicesSubject.asObservable(),
      ),
      subscribeToDeviceDisconnectedEvents: jest.fn(() =>
        deviceDisconnectedSubject.asObservable(),
      ),
      subscribeToTransportLogs: jest.fn(() =>
        transportLogsSubject.asObservable(),
      ),
      connectDevice: wrapperConnectDevice,
      disconnectDevice: wrapperDisconnectDevice,
      sendApdu: wrapperSendApdu,
    };
  });

  test("getIdentifier returns TRANSPORT_IDENTIFIER", () => {
    // given
    const transport = new RNHidTransport(
      true,
      nativeModuleWrapper,
      loggerServiceFactory,
    );
    // then
    expect(transport.getIdentifier()).toBe(TRANSPORT_IDENTIFIER);
  });

  describe("isSupported returns the provided support flag", () => {
    test("supported", () => {
      // given
      const transportTrue = new RNHidTransport(
        true, // when
        nativeModuleWrapper,
        loggerServiceFactory,
      );
      // then
      expect(transportTrue.isSupported()).toBe(true);
    });

    test("not supported", () => {
      // given
      const transportFalse = new RNHidTransport(
        false, // when
        nativeModuleWrapper,
        loggerServiceFactory,
      );
      // then
      expect(transportFalse.isSupported()).toBe(false);
    });
  });

  test("constructor subscribes to transport logs and calls logger methods", () => {
    // given
    new RNHidTransport(true, nativeModuleWrapper, loggerServiceFactory);

    // when
    const logEvent: LogParams = [
      LogLevel.Info,
      "Test message",
      {
        tag: "TestTag",
        data: { key: "value" },
        timestamp: 123456789,
      },
    ];
    transportLogsSubject.next(logEvent);

    // then
    expect(fakeLogger.info).toHaveBeenCalledWith("Test message", {
      tag: "TestTag",
      data: { key: "value" },
      timestamp: 123456789,
    });
  });

  describe("startDiscovering", () => {
    it("calls startScan", () => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      transport.startDiscovering().subscribe();

      // then
      expect(wrapperStartScan).toHaveBeenCalled();
    });

    it("emits new discovered devices", (done) => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );
      const discoveredDevices: TransportDiscoveredDevice[] = [];

      // when
      transport.startDiscovering().subscribe({
        next: (device) => {
          discoveredDevices.push(device);
          if (discoveredDevices.length === 3) {
            try {
              // then
              expect(discoveredDevices).toEqual([
                mockDiscoveredDevice1,
                mockDiscoveredDevice2,
                mockDiscoveredDevice3,
              ]);
              done();
            } catch (e) {
              done(e);
            }
          }
        },
        error: done,
      });
      // Simulate getObservableOfArraysNewItems behavior:
      // emit first array with one device then the subsequent arrays with a new device.
      discoveredDevicesSubject.next([mockDiscoveredDevice1]);
      discoveredDevicesSubject.next([
        mockDiscoveredDevice1,
        mockDiscoveredDevice2,
      ]);
      discoveredDevicesSubject.next([
        mockDiscoveredDevice1,
        mockDiscoveredDevice2,
        mockDiscoveredDevice3,
      ]);
    });

    it("propagates startScan error", (done) => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      const error = new Error("scan failed");
      wrapperStartScan.mockRejectedValueOnce(error);
      transport.startDiscovering().subscribe({
        next: () => {},
        error: (err) => {
          try {
            // then
            expect(err).toBe(error);
            done();
          } catch (e) {
            done(e);
          }
        },
      });
    });
  });

  describe("stopDiscovering", () => {
    it("calls stopScan", async () => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      await transport.stopDiscovering();

      // then
      expect(nativeModuleWrapper.stopScan).toHaveBeenCalled();
    });

    it("logs error when stopScan fails", async () => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      const error = new Error("stop failed");
      wrapperStopScan.mockRejectedValueOnce(error);

      // then
      await transport.stopDiscovering();
      expect(fakeLogger.error).toHaveBeenCalledWith(
        "stopDiscovering error",
        error,
      );
    });
  });

  describe("listenToKnownDevices", () => {
    it("emits arrays of discovered devices", (done) => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );
      const observedEvents: Array<Array<TransportDiscoveredDevice>> = [];

      // when
      transport.listenToKnownDevices().subscribe({
        next: (devices) => {
          observedEvents.push(devices);
          if (observedEvents.length === 2) {
            try {
              // then
              expect(observedEvents).toEqual([
                [mockDiscoveredDevice1, mockDiscoveredDevice2],
                [mockDiscoveredDevice1, mockDiscoveredDevice3],
              ]);
              done();
            } catch (e) {
              done(e);
            }
          }
        },
        complete: () => {
          done("should not complete");
        },
        error: done,
      });

      discoveredDevicesSubject.next([
        mockDiscoveredDevice1,
        mockDiscoveredDevice2,
      ]);
      discoveredDevicesSubject.next([
        mockDiscoveredDevice1,
        mockDiscoveredDevice3,
      ]);
    });

    it("propagates startScan error", (done) => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      const error = new Error("start scan failed");
      wrapperStartScan.mockRejectedValueOnce(error);
      transport.listenToKnownDevices().subscribe({
        error: (err) => {
          // then
          expect(err).toBe(error);
          done();
        },
      });
    });

    it("calls stopScan on unsubscribe", () => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      const error = new Error("stop scan failed");
      wrapperStopScan.mockRejectedValueOnce(error);
      const subscription = transport.listenToKnownDevices().subscribe({});
      subscription.unsubscribe();

      expect(wrapperStopScan).toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    describe("connection successful", () => {
      it("should return a Right(TransportConnectedDevice) on successful connection", async () => {
        // given
        const fakeDeviceModel = { model: "TestModel" };
        const sessionId = "session123";
        wrapperConnectDevice.mockResolvedValueOnce(
          Right({ sessionId, transportDeviceModel: fakeDeviceModel }),
        );
        const transport = new RNHidTransport(
          true,
          nativeModuleWrapper,
          loggerServiceFactory,
        );

        // when
        const result = await transport.connect({
          deviceId: sessionId,
          onDisconnect: jest.fn(),
        });

        // then
        expect(result.isRight()).toBe(true);
        const connectedDevice = result.extract() as TransportConnectedDevice;
        expect(connectedDevice).toBeInstanceOf(TransportConnectedDevice);
        expect(connectedDevice.id).toBe(sessionId);
        expect(connectedDevice.deviceModel).toEqual(fakeDeviceModel);
        expect(connectedDevice.transport).toBe(TRANSPORT_IDENTIFIER);
        expect(connectedDevice.type).toBe("USB");
      });

      test("should trigger onDisconnect when a matching disconnect event is emitted", async () => {
        // given
        const fakeDeviceModel = { model: "TestModel" };
        const sessionId = "session123";
        wrapperConnectDevice.mockResolvedValueOnce(
          Right({ sessionId, transportDeviceModel: fakeDeviceModel }),
        );
        const transport = new RNHidTransport(
          true,
          nativeModuleWrapper,
          loggerServiceFactory,
        );
        const onDisconnect = jest.fn();

        // when
        await transport.connect({
          deviceId: sessionId,
          onDisconnect,
        });
        deviceDisconnectedSubject.next({ sessionId });

        // then
        expect(onDisconnect).toHaveBeenCalledWith(sessionId);
      });

      test("should handle sendApdu success (Right)", async () => {
        // given
        const fakeDeviceModel = { model: "TestModel" };
        const sessionId = "session123";
        wrapperConnectDevice.mockResolvedValueOnce(
          Right({ sessionId, transportDeviceModel: fakeDeviceModel }),
        );
        const transport = new RNHidTransport(
          true,
          nativeModuleWrapper,
          loggerServiceFactory,
        );
        const result = await transport.connect({
          deviceId: sessionId,
          onDisconnect: jest.fn(),
        });
        const connectedDevice = result.extract() as TransportConnectedDevice;

        // when
        wrapperSendApdu.mockResolvedValueOnce(Right("apduResponse"));
        const apdu = new Uint8Array([1, 2, 3]);
        const apduResult = await connectedDevice.sendApdu(apdu);

        // then
        expect(nativeModuleWrapper.sendApdu).toHaveBeenCalledWith(
          sessionId,
          apdu,
        );
        expect(apduResult).toEqual(Right("apduResponse"));
      });

      test("should handle sendApdu failure (Left)", async () => {
        // given
        const fakeDeviceModel = { model: "TestModel" };
        const sessionId = "session123";
        wrapperConnectDevice.mockResolvedValueOnce(
          Right({ sessionId, transportDeviceModel: fakeDeviceModel }),
        );
        const transport = new RNHidTransport(
          true,
          nativeModuleWrapper,
          loggerServiceFactory,
        );
        const result = await transport.connect({
          deviceId: sessionId,
          onDisconnect: jest.fn(),
        });
        const connectedDevice = result.extract() as TransportConnectedDevice;

        // when
        wrapperSendApdu.mockResolvedValueOnce(Left("some error"));
        const apdu = new Uint8Array([1, 2, 3]);
        const apduResult = await connectedDevice.sendApdu(apdu);

        // then
        expect(apduResult).toEqual(Left("some error"));
      });

      test("should handle sendApdu rejection", async () => {
        // given
        const fakeDeviceModel = { model: "TestModel" };
        const sessionId = "session123";
        wrapperConnectDevice.mockResolvedValueOnce(
          Right({ sessionId, transportDeviceModel: fakeDeviceModel }),
        );
        const transport = new RNHidTransport(
          true,
          nativeModuleWrapper,
          loggerServiceFactory,
        );
        const result = await transport.connect({
          deviceId: sessionId,
          onDisconnect: jest.fn(),
        });
        const connectedDevice = result.extract() as TransportConnectedDevice;
        const apduError = new Error("apdu failed");

        // when
        wrapperSendApdu.mockRejectedValueOnce(apduError);
        const apduResult = await connectedDevice.sendApdu(new Uint8Array([]));

        // then
        expect(apduResult).toEqual(Left(new SendApduError(apduError)));
      });
    });

    describe("connection failure", () => {
      test("should return a Left when nativeModuleWrapper.connectDevice resolves a Left", async () => {
        // given
        const transport = new RNHidTransport(
          true,
          nativeModuleWrapper,
          loggerServiceFactory,
        );

        // when
        const errorResult = Left(
          new OpeningConnectionError("connection failed"),
        );
        wrapperConnectDevice.mockResolvedValueOnce(errorResult);
        const result = await transport.connect({
          deviceId: "any",
          onDisconnect: jest.fn(),
        });

        // then
        expect(result).toEqual(errorResult);
      });

      test("should return a Left when nativeModuleWrapper.connectDevice rejects", async () => {
        // given
        const error = new Error("connection failed");
        const transport = new RNHidTransport(
          true,
          nativeModuleWrapper,
          loggerServiceFactory,
        );

        // when
        wrapperConnectDevice.mockRejectedValueOnce(error);
        const result = await transport.connect({
          deviceId: "any",
          onDisconnect: jest.fn(),
        });

        // then
        expect(result).toEqual(Left(new OpeningConnectionError(error)));
      });
    });
  });

  describe("disconnect", () => {
    it("returns Right on successful disconnect", async () => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      const result = await transport.disconnect({
        connectedDevice: { id: "session789" } as TransportConnectedDevice,
      });

      // then
      expect(nativeModuleWrapper.disconnectDevice).toHaveBeenCalledWith(
        "session789",
      );
      expect(result).toEqual(Right(undefined));
    });

    it("returns Left on disconnect failure", async () => {
      // given
      const transport = new RNHidTransport(
        true,
        nativeModuleWrapper,
        loggerServiceFactory,
      );

      // when
      const error = new Error("disconnect failed");
      wrapperDisconnectDevice.mockRejectedValueOnce(error);
      const result = await transport.disconnect({
        connectedDevice: { id: "session000" } as TransportConnectedDevice,
      });

      // then
      expect(result).toEqual(Left(new DisconnectError(error)));
    });
  });
});

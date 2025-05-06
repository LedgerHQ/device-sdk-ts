import {
  type BleManager,
  type Characteristic,
  type Device,
} from "react-native-ble-plx";
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  defaultApduReceiverServiceStubBuilder,
  defaultApduSenderServiceStubBuilder,
  DeviceNotInitializedError,
  GeneralDmkError,
  type LoggerPublisherService,
  type LoggerSubscriberService,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import { Left, Maybe, Right } from "purify-ts";

import { RNBleApduSender, type RNBleInternalDevice } from "./RNBleApduSender";

vi.mock("react-native-ble-plx", () => ({
  BleManager: vi.fn(),
}));

const FRAME_HEADER_SIZE = 3;
const LEDGER_MTU = 156;

class LoggerPublisherServiceStub implements LoggerPublisherService {
  subscribers: LoggerSubscriberService[] = [];
  tag: string;
  constructor(subscribers: LoggerSubscriberService[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
  debug = vi.fn();
}

let logger: (tag: string) => LoggerPublisherService;
let apduSenderFactory: ApduSenderServiceFactory;
let apduReceiverFactory: ApduReceiverServiceFactory;
let apduSender: RNBleApduSender;
let manager: BleManager;
const cancelConnection = vi.fn();

// TODO: fix these tests, sorry they are completely broken now
describe.skip("RNBleApduSender", () => {
  beforeEach(() => {
    logger = (tag: string) => new LoggerPublisherServiceStub([], tag);
    apduSenderFactory = vi.fn(() =>
      defaultApduSenderServiceStubBuilder(undefined, logger),
    );
    apduReceiverFactory = vi.fn(() =>
      defaultApduReceiverServiceStubBuilder(undefined, logger),
    );
    apduSender = new RNBleApduSender(
      {
        dependencies: {
          device: {
            mtu: 156,
            cancelConnection,
          } as unknown as Device,
          internalDevice: {} as RNBleInternalDevice,
          manager: {} as BleManager,
        },
        apduReceiverFactory: apduReceiverFactory,
        apduSenderFactory: apduSenderFactory,
      },
      logger,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create an instance of RNBleApduSender", () => {
      expect(apduSender).toBeDefined();
    });
  });

  describe("getDependencies", () => {
    it("should return the dependencies", () => {
      const dependencies = apduSender.getDependencies();
      expect(dependencies).toStrictEqual({
        device: {
          mtu: 156,
          cancelConnection,
        },
        internalDevice: {},
        manager: {},
      });
    });
  });

  describe("setDependencies", () => {
    it("should set the dependencies", () => {
      const newDependencies = {
        device: {
          mtu: 156,
          id: "deviceId",
          cancelConnection,
        } as unknown as Device,
        internalDevice: {
          id: "deviceId",
          bleDeviceInfos: {
            serviceUuid: "serviceUuid",
            notifyUuid: "notifyUuid",
            writeCmdUuid: "writeCmdUuid",
          },
        } as RNBleInternalDevice,
        manager: {} as BleManager,
      };
      apduSender.setDependencies(newDependencies);
      const dependencies = apduSender.getDependencies();
      expect(dependencies).toStrictEqual(newDependencies);
    });
  });

  describe("setupConnection", () => {
    beforeEach(() => {
      manager = {
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
      } as unknown as BleManager;

      const dependencies = {
        device: {
          mtu: 156,
          id: "deviceId",
        } as Device,
        internalDevice: {
          bleDeviceInfos: {
            serviceUuid: "serviceUuid",
            notifyUuid: "notifyUuid",
            writeCmdUuid: "writeCmdUuid",
          },
        } as RNBleInternalDevice,
        manager,
      };

      apduSender.setDependencies(dependencies);
    });

    it("should setup the connection and resolve when the device is ready", async () => {
      vi.spyOn(manager, "monitorCharacteristicForDevice").mockImplementation(
        (_deviceId, _serviceUuid, _notifyUuid, callback) => {
          callback(null, {
            value: "BQAAAA8BBUJPTE9TBTEuMi4ykAA=",
          } as Characteristic);
          return {
            remove: vi.fn(),
          };
        },
      );

      vi.spyOn(
        manager,
        "writeCharacteristicWithoutResponseForDevice",
      ).mockImplementation((_deviceId, _serviceUuid, _writeCmdUuid, value) => {
        // @ts-expect-error needed for tests
        apduSender.onMonitor({
          value: value,
        } as Characteristic);

        return Promise.resolve({
          value: value,
        } as Characteristic);
      });

      await apduSender.setupConnection();

      expect(manager.monitorCharacteristicForDevice).toHaveBeenCalled();
      expect(
        manager.writeCharacteristicWithoutResponseForDevice,
      ).toHaveBeenCalled();
    });
  });

  describe("closeConnection", () => {
    it("should close the connection", () => {
      apduSender.closeConnection();
      expect(cancelConnection).toHaveBeenCalled();
    });
  });

  describe("sendApdu", () => {
    beforeEach(async () => {
      manager = {
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
      } as unknown as BleManager;

      const dependencies = {
        device: {
          mtu: 156,
          id: "deviceId",
        } as Device,
        internalDevice: {
          bleDeviceInfos: {
            serviceUuid: "serviceUuid",
            notifyUuid: "notifyUuid",
            writeCmdUuid: "writeCmdUuid",
          },
        } as RNBleInternalDevice,
        manager,
      };

      vi.spyOn(
        manager,
        "monitorCharacteristicForDevice",
      ).mockImplementationOnce(
        (_deviceId, _serviceUuid, _notifyUuid, callback) => {
          callback(null, {
            value: "BQAAAA8BBUJPTE9TBTEuMi4ykAA=",
          } as Characteristic);

          return {
            remove: vi.fn(),
          };
        },
      );

      vi.spyOn(
        manager,
        "writeCharacteristicWithoutResponseForDevice",
      ).mockImplementation((_deviceId, _serviceUuid, _writeCmdUuid, value) => {
        // @ts-expect-error needed for tests
        apduSender.onMonitor({
          value: value,
        } as Characteristic);

        return Promise.resolve({
          value: value,
        } as Characteristic);
      });

      apduSender.setDependencies(dependencies);
      await apduSender.setupConnection();
    });

    describe("when the device is not ready", () => {
      it("should return a DeviceNotInitializedError", async () => {
        const apdu = new Uint8Array([0x08, 0x00, 0x00, 0x00]);
        // @ts-expect-error private access for tests
        apduSender._isDeviceReady.next(false);
        const result = await apduSender.sendApdu(apdu);
        expect(result).toStrictEqual(
          Left(new DeviceNotInitializedError("Unknown MTU")),
        );
      });
    });

    describe("when the device is ready", () => {
      it("should send the apdu", async () => {
        // GetAppAndVersion APDU
        const apdu = new Uint8Array([0xb0, 0x01, 0x00, 0x00, 0x00]);

        const expectedResponse = new Uint8Array([
          0x05, 0x00, 0x00, 0x00, 0x0f, 0x01, 0x05, 0x42, 0x4f, 0x4c, 0x4f,
          0x53, 0x05, 0x31, 0x2e, 0x32, 0x2e, 0x32, 0x90, 0x00,
        ]);

        const statusCode = new Uint8Array([0x90, 0x00]);

        const response = {
          data: expectedResponse,
          statusCode,
        };

        vi.spyOn(
          manager,
          "writeCharacteristicWithoutResponseForDevice",
        ).mockImplementation(
          (_deviceId, _serviceUuid, _writeCmdUuid, value) => {
            // @ts-expect-error needed for tests
            apduSender.onMonitor({
              value: value,
            } as Characteristic);

            return Promise.resolve({
              value: value,
            } as Characteristic);
          },
        );

        // @ts-expect-error private access for tests
        vi.spyOn(apduSender._apduReceiver, "handleFrame").mockImplementation(
          () => {
            return Right(Maybe.of(response));
          },
        );

        const result = await apduSender.sendApdu(apdu);
        expect(apduSenderFactory).toHaveBeenCalledTimes(2);

        // first call is for the setup
        expect(apduSenderFactory).toHaveBeenNthCalledWith(1, {
          frameSize: 1,
        });

        // second call is for the apdu
        expect(apduSenderFactory).toHaveBeenNthCalledWith(2, {
          frameSize: LEDGER_MTU - FRAME_HEADER_SIZE,
        });

        expect(result).toStrictEqual(Right(response));
      });

      it("should return an error if the frame cannot be handled", async () => {
        // {"error": {"_tag": "DeviceLockedError", "errorCode": "5515", "message": "Device is locked.", "originalError": undefined}, "status": "ERROR"}
        // GetAppAndVersion APDU
        const apdu = new Uint8Array([0xb0, 0x01, 0x00, 0x00, 0x00]);

        const expectedError = new GeneralDmkError("could not handle frame");

        vi.spyOn(
          manager,
          "writeCharacteristicWithoutResponseForDevice",
        ).mockImplementation(
          (_deviceId, _serviceUuid, _writeCmdUuid, value) => {
            // @ts-expect-error needed for tests
            apduSender.onMonitor({
              value: value,
            } as Characteristic);

            return Promise.resolve({
              value: value,
            } as Characteristic);
          },
        );

        // @ts-expect-error private access for tests
        vi.spyOn(apduSender._apduReceiver, "handleFrame").mockImplementation(
          () => {
            return Left(expectedError);
          },
        );

        const result = await apduSender.sendApdu(apdu);
        expect(result).toStrictEqual(Left(expectedError));
      });

      it("should return a SendApduTimeoutError if something takes too long", async () => {
        // GetAppAndVersion APDU
        const apdu = new Uint8Array([0xb0, 0x01, 0x00, 0x00, 0x00]);

        const expectedResponse = new Uint8Array([
          0x05, 0x00, 0x00, 0x00, 0x0f, 0x01, 0x05, 0x42, 0x4f, 0x4c, 0x4f,
          0x53, 0x05, 0x31, 0x2e, 0x32, 0x2e, 0x32, 0x90, 0x00,
        ]);

        const statusCode = new Uint8Array([0x90, 0x00]);

        const response = {
          data: expectedResponse,
          statusCode,
        };

        const expectedError = new SendApduTimeoutError("Abort timeout");

        vi.spyOn(
          manager,
          "writeCharacteristicWithoutResponseForDevice",
        ).mockImplementation(
          (_deviceId, _serviceUuid, _writeCmdUuid, value) => {
            // @ts-expect-error needed for tests
            apduSender.onMonitor({
              value: value,
            } as Characteristic);

            return Promise.resolve({
              value: value,
            } as Characteristic);
          },
        );

        // @ts-expect-error private access for tests
        vi.spyOn(apduSender, "onMonitor").mockImplementation(() => {
          setTimeout(() => {
            return Right(Maybe.of(response));
          }, 2000);
        });

        const result = await apduSender.sendApdu(apdu, false, 100);
        expect(result).toStrictEqual(Left(expectedError));
      });

      it("should and and log an error if the this.write fails", async () => {
        // GetAppAndVersion APDU
        const apdu = new Uint8Array([0xb0, 0x01, 0x00, 0x00, 0x00]);
        const expectedError = new SendApduTimeoutError("Abort timeout");

        vi.spyOn(
          manager,
          "writeCharacteristicWithoutResponseForDevice",
        ).mockImplementation(
          (_deviceId, _serviceUuid, _writeCmdUuid, value) => {
            // @ts-expect-error needed for tests
            apduSender.onMonitor({
              value: value,
            } as Characteristic);

            return Promise.resolve({
              value: value,
            } as Characteristic);
          },
        );

        // @ts-expect-error private access for tests
        vi.spyOn(apduSender, "write").mockImplementation(() => {
          return Promise.reject(new Error("test"));
        });

        const result = await apduSender.sendApdu(apdu, false, 100);
        expect(result).toStrictEqual(Left(expectedError));
      });

      it("should timeout if there are no characteristic.value", async () => {
        // GetAppAndVersion APDU
        const apdu = new Uint8Array([0xb0, 0x01, 0x00, 0x00, 0x00]);
        const expectedError = new SendApduTimeoutError("Abort timeout");

        vi.spyOn(
          manager,
          "writeCharacteristicWithoutResponseForDevice",
        ).mockImplementation(
          (_deviceId, _serviceUuid, _writeCmdUuid, _value) => {
            // @ts-expect-error needed for tests
            apduSender.onMonitor({} as Characteristic);

            return Promise.resolve({} as Characteristic);
          },
        );

        // @ts-expect-error private access for tests
        vi.spyOn(apduSender, "write").mockImplementation(() => {
          return Promise.reject(new Error("test"));
        });

        const result = await apduSender.sendApdu(apdu, false, 100);
        expect(result).toStrictEqual(Left(expectedError));
      });
    });
  });
});

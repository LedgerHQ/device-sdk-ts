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
  type LoggerPublisherService,
  type LoggerSubscriberService,
} from "@ledgerhq/device-management-kit";

import { RNBleApduSender, type RNBleInternalDevice } from "./RNBleApduSender";

vi.mock("react-native-ble-plx", () => ({
  BleManager: vi.fn(),
}));

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
describe("RNBleApduSender", () => {
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
          device: {} as Device,
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
        device: {},
        internalDevice: {},
        manager: {},
      });
    });
  });

  describe("setDependencies", () => {
    it("should set the dependencies", () => {
      const newDependencies = {
        device: {
          id: "deviceId",
        } as Device,
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

    it("should setup the connection", () => {
      vi.spyOn(manager, "monitorCharacteristicForDevice").mockImplementation(
        (_deviceId, _serviceUuid, _notifyUuid, callback) => {
          callback(null, { value: "155" } as Characteristic);
          return {
            remove: vi.fn(),
          };
        },
      );
      apduSender.setupConnection();
      expect(manager.monitorCharacteristicForDevice).toHaveBeenCalled();
      expect(
        manager.writeCharacteristicWithoutResponseForDevice,
      ).toHaveBeenCalled();
    });
  });
});

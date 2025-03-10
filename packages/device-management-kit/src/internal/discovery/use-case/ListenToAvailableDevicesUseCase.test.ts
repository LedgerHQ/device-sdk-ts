import { Just } from "purify-ts";
import { Subject } from "rxjs";

import { type DeviceId, DeviceModel } from "@api/device/DeviceModel";
import { deviceModelStubBuilder } from "@api/device-model/model/DeviceModel.stub";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { type Transport } from "@api/transport/model/Transport";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";
import { type TransportService } from "@internal/transport/service/TransportService";

import { ListenToAvailableDevicesUseCase } from "./ListenToAvailableDevicesUseCase";

vi.mock("@internal/transport/service/DefaultTransportService");

let transportService: TransportService;
let logger: LoggerPublisherService;
function makeMockTransport(props: Partial<Transport>): Transport {
  return {
    listenToAvailableDevices: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    startDiscovering: vi.fn(),
    stopDiscovering: vi.fn(),
    getIdentifier: vi.fn(),
    isSupported: vi.fn(),
    ...props,
  };
}

const mockInternalDeviceModel = deviceModelStubBuilder();
function makeMockDeviceModel(id: DeviceId): DeviceModel {
  return new DeviceModel({
    id,
    model: mockInternalDeviceModel.id,
    name: mockInternalDeviceModel.productName,
  });
}

function setup2MockTransports() {
  const transportAKnownDevicesSubject = new Subject<
    TransportDiscoveredDevice[]
  >();
  const transportBKnownDevicesSubject = new Subject<
    TransportDiscoveredDevice[]
  >();
  const transportA = makeMockTransport({
    listenToAvailableDevices: () =>
      transportAKnownDevicesSubject.asObservable(),
    getIdentifier: () => "mock-A",
  });
  const transportB = makeMockTransport({
    listenToAvailableDevices: () =>
      transportBKnownDevicesSubject.asObservable(),
    getIdentifier: () => "mock-B",
  });
  return {
    transportAKnownDevicesSubject,
    transportBKnownDevicesSubject,
    transportA,
    transportB,
  };
}

function makeMockTransportDiscoveredDevice(
  id: string,
): TransportDiscoveredDevice {
  return {
    id,
    deviceModel: mockInternalDeviceModel,
    transport: "mock",
  };
}

describe("ListenToAvailableDevicesUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error mock
    transportService = new DefaultTransportService();
    logger = new DefaultLoggerPublisherService(
      [],
      "listen-to-available-devices-use-case-test",
    );
  });

  describe("when no transports are available", () => {
    it("should return no discovered devices", () =>
      new Promise<void>((resolve, reject) => {
        vi.spyOn(transportService, "getAllTransports").mockReturnValue([]);

        const useCase = new ListenToAvailableDevicesUseCase(
          transportService,
          () => logger,
        );

        const observedDiscoveredDevices: DiscoveredDevice[][] = [];
        useCase.execute({}).subscribe({
          next: (devices) => {
            observedDiscoveredDevices.push(devices);
          },
          complete: () => {
            try {
              expect(observedDiscoveredDevices).toEqual([[]]);
              resolve();
            } catch (error) {
              reject(error as Error);
            }
          },
          error: (error) => {
            reject(error);
          },
        });
      }));
  });

  describe("when one transport is available", () => {
    it("should return discovered devices from one transport", () => {
      const { transportA, transportAKnownDevicesSubject } =
        setup2MockTransports();

      vi.spyOn(transportService, "getAllTransports").mockReturnValue([
        transportA,
      ]);

      const observedDiscoveredDevices: DiscoveredDevice[][] = [];
      new ListenToAvailableDevicesUseCase(transportService, () => logger)
        .execute({})
        .subscribe((devices) => {
          observedDiscoveredDevices.push(devices);
        });

      // When transportA emits 1 known device
      transportAKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportA-device1"),
      ]);

      expect(observedDiscoveredDevices[0]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          name: "Ledger Nano X",
          transport: "mock",
          rssi: undefined,
        },
      ]);

      // When transportA emits 2 known devices
      transportAKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportA-device1"),
        makeMockTransportDiscoveredDevice("transportA-device2"),
      ]);

      expect(observedDiscoveredDevices[1]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
        {
          id: "transportA-device2",
          deviceModel: makeMockDeviceModel("transportA-device2"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transportA emits 1 known device (device1 disconnects)
      transportAKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportA-device2"),
      ]);

      expect(observedDiscoveredDevices[2]).toEqual([
        {
          id: "transportA-device2",
          deviceModel: makeMockDeviceModel("transportA-device2"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transportA emits 0 known devices (device2 disconnects)
      transportAKnownDevicesSubject.next([]);

      expect(observedDiscoveredDevices[3]).toEqual([]);
    });
  });

  describe("when multiple transports are available", () => {
    it("should return discovered devices from one of the transports as soon as it emits", () => {
      const { transportAKnownDevicesSubject, transportA, transportB } =
        setup2MockTransports();

      vi.spyOn(transportService, "getAllTransports").mockReturnValue([
        transportA,
        transportB,
      ]);

      const observedDiscoveredDevices: DiscoveredDevice[][] = [];

      const onError = vi.fn();
      const onComplete = vi.fn();

      new ListenToAvailableDevicesUseCase(transportService, () => logger)
        .execute({})
        .subscribe({
          next: (devices) => {
            observedDiscoveredDevices.push(devices);
          },
          error: onError,
          complete: onComplete,
        });

      // When transportA emits 1 known device
      transportAKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportA-device1"),
      ]);

      expect(observedDiscoveredDevices[0]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transport A listen observable completes
      transportAKnownDevicesSubject.complete();

      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled(); // Should not complete yet because transportB has not completed
    });

    it("should combine discovered devices from multiple transports", () => {
      const {
        transportAKnownDevicesSubject,
        transportBKnownDevicesSubject,
        transportA,
        transportB,
      } = setup2MockTransports();

      const observedDiscoveredDevices: DiscoveredDevice[][] = [];

      vi.spyOn(transportService, "getAllTransports").mockReturnValue([
        transportA,
        transportB,
      ]);

      const onError = vi.fn();
      const onComplete = vi.fn();
      new ListenToAvailableDevicesUseCase(transportService, () => logger)
        .execute({})
        .subscribe({
          next: (devices) => {
            observedDiscoveredDevices.push(devices);
          },
          error: onError,
          complete: onComplete,
        });

      // When transportA emits 1 known device
      transportAKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportA-device1"),
      ]);

      expect(observedDiscoveredDevices[0]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transportB emits 1 known device
      transportBKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportB-device1"),
      ]);

      expect(observedDiscoveredDevices[1]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
        {
          id: "transportB-device1",
          deviceModel: makeMockDeviceModel("transportB-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transportB emits 2 known devices
      transportBKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportB-device1"),
        makeMockTransportDiscoveredDevice("transportB-device2"),
      ]);

      expect(observedDiscoveredDevices[2]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
        {
          id: "transportB-device1",
          deviceModel: makeMockDeviceModel("transportB-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
        {
          id: "transportB-device2",
          deviceModel: makeMockDeviceModel("transportB-device2"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transportA emits 0 known devices
      transportAKnownDevicesSubject.next([]);

      expect(observedDiscoveredDevices[3]).toEqual([
        {
          id: "transportB-device1",
          deviceModel: makeMockDeviceModel("transportB-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
        {
          id: "transportB-device2",
          deviceModel: makeMockDeviceModel("transportB-device2"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transport A listen observable completes
      transportAKnownDevicesSubject.complete();

      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled(); // Should not complete yet because transportB has not completed

      // When transport B emits 0 known devices
      transportBKnownDevicesSubject.next([]);

      expect(observedDiscoveredDevices[4]).toEqual([]);

      // When transport B listen observable completes
      transportBKnownDevicesSubject.complete();

      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled(); // Should complete now because all transports have completed
    });

    it("should filter out the devices by transport", () => {
      const {
        transportAKnownDevicesSubject,
        transportBKnownDevicesSubject,
        transportA,
        transportB,
      } = setup2MockTransports();

      const all = vi
        .spyOn(transportService, "getAllTransports")
        .mockReturnValue([transportA, transportB]);

      vi.spyOn(transportService, "getTransport").mockReturnValue(
        Just(transportA),
      );

      const observedDiscoveredDevices: DiscoveredDevice[][] = [];

      const onError = vi.fn();
      const onComplete = vi.fn();

      new ListenToAvailableDevicesUseCase(transportService, () => logger)
        .execute({ transport: "mock-A" })
        .subscribe({
          next: (devices) => {
            observedDiscoveredDevices.push(devices);
          },
          error: onError,
          complete: onComplete,
        });

      expect(all).toBeCalledTimes(1);
      expect(transportService.getTransport).toBeCalledWith("mock-A");

      // When transportA emits 1 known device
      transportAKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportA-device1"),
      ]);

      expect(observedDiscoveredDevices[0]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // When transportB emits 1 known device
      transportBKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportB-device1"),
      ]);

      expect(observedDiscoveredDevices.length).toEqual(1);

      // When transportB emits 2 known devices
      transportBKnownDevicesSubject.next([
        makeMockTransportDiscoveredDevice("transportB-device1"),
        makeMockTransportDiscoveredDevice("transportB-device2"),
      ]);

      // Only transportA is listened to, so only transportA devices should be returned
      expect(observedDiscoveredDevices.length).toEqual(1);

      // // When transportA emits 0 known devices
      transportAKnownDevicesSubject.next([]);

      expect(observedDiscoveredDevices[0]).toEqual([
        {
          id: "transportA-device1",
          deviceModel: makeMockDeviceModel("transportA-device1"),
          transport: "mock",
          name: "Ledger Nano X",
          rssi: undefined,
        },
      ]);

      // // When transport A listen observable completes
      transportAKnownDevicesSubject.complete();

      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledOnce(); // Should complete now because transportA has completed

      // When transport B emits 0 known devices
      transportBKnownDevicesSubject.next([]);

      expect(observedDiscoveredDevices[1]).toEqual([]);

      // When transport B listen observable completes
      transportBKnownDevicesSubject.complete();

      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledOnce(); // Should not rerun complete because transportB is not listened to
    });
  });
});

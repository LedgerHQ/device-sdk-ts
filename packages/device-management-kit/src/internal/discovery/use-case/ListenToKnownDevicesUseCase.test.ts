import { Subject } from "rxjs";

import { type DeviceId, type DeviceModel } from "@api/device/DeviceModel";
import { deviceModelStubBuilder } from "@api/device-model/model/DeviceModel.stub";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { type DiscoveredDevice, type Transport } from "@api/types";
import { type TransportService } from "@internal/transport/service/TransportService";
import { TransportServiceStub } from "@internal/transport/service/TransportService.stub";

import { ListenToKnownDevicesUseCase } from "./ListenToKnownDevicesUseCase";

let transportService: TransportService;
function makeMockTransport(props: Partial<Transport>): Transport {
  return {
    listenToKnownDevices: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    startDiscovering: jest.fn(),
    stopDiscovering: jest.fn(),
    getIdentifier: jest.fn(),
    isSupported: jest.fn(),
    ...props,
  };
}

const mockInternalDeviceModel = deviceModelStubBuilder();
function makeMockDeviceModel(id: DeviceId): DeviceModel {
  return {
    id,
    model: mockInternalDeviceModel.id,
    name: mockInternalDeviceModel.productName,
  };
}

function setup2MockTransports() {
  const transportAKnownDevicesSubject = new Subject<
    TransportDiscoveredDevice[]
  >();
  const transportBKnownDevicesSubject = new Subject<
    TransportDiscoveredDevice[]
  >();
  const transportA = makeMockTransport({
    listenToKnownDevices: () => transportAKnownDevicesSubject.asObservable(),
  });
  const transportB = makeMockTransport({
    listenToKnownDevices: () => transportBKnownDevicesSubject.asObservable(),
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

describe("ListenToKnownDevicesUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error stub
    transportService = new TransportServiceStub();
  });

  describe("when no transports are available", () => {
    it("should return no discovered devices", (done) => {
      jest.spyOn(transportService, "getAllTransports").mockReturnValue([]);

      const useCase = new ListenToKnownDevicesUseCase(transportService);

      const observedDiscoveredDevices: DiscoveredDevice[][] = [];
      useCase.execute().subscribe({
        next: (devices) => {
          observedDiscoveredDevices.push(devices);
        },
        complete: () => {
          try {
            expect(observedDiscoveredDevices).toEqual([[]]);
            done();
          } catch (error) {
            done(error);
          }
        },
        error: (error) => {
          done(error);
        },
      });
    });
  });

  describe("when one transport is available", () => {
    it("should return discovered devices from one transport", () => {
      const { transportA, transportAKnownDevicesSubject } =
        setup2MockTransports();

      jest
        .spyOn(transportService, "getAllTransports")
        .mockReturnValue([transportA]);

      const observedDiscoveredDevices: DiscoveredDevice[][] = [];
      new ListenToKnownDevicesUseCase(transportService)
        .execute()
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
          transport: "mock",
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
        },
        {
          id: "transportA-device2",
          deviceModel: makeMockDeviceModel("transportA-device2"),
          transport: "mock",
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

      jest
        .spyOn(transportService, "getAllTransports")
        .mockReturnValue([transportA, transportB]);

      const observedDiscoveredDevices: DiscoveredDevice[][] = [];

      const onError = jest.fn();
      const onComplete = jest.fn();

      new ListenToKnownDevicesUseCase(transportService).execute().subscribe({
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

      jest
        .spyOn(transportService, "getAllTransports")
        .mockReturnValue([transportA, transportB]);

      const onError = jest.fn();
      const onComplete = jest.fn();
      new ListenToKnownDevicesUseCase(transportService).execute().subscribe({
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
        },
        {
          id: "transportB-device1",
          deviceModel: makeMockDeviceModel("transportB-device1"),
          transport: "mock",
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
        },
        {
          id: "transportB-device1",
          deviceModel: makeMockDeviceModel("transportB-device1"),
          transport: "mock",
        },
        {
          id: "transportB-device2",
          deviceModel: makeMockDeviceModel("transportB-device2"),
          transport: "mock",
        },
      ]);

      // When transportA emits 0 known devices
      transportAKnownDevicesSubject.next([]);

      expect(observedDiscoveredDevices[3]).toEqual([
        {
          id: "transportB-device1",
          deviceModel: makeMockDeviceModel("transportB-device1"),
          transport: "mock",
        },
        {
          id: "transportB-device2",
          deviceModel: makeMockDeviceModel("transportB-device2"),
          transport: "mock",
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
  });
});

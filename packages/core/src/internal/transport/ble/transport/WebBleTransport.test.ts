import { Left } from "purify-ts";

import { DeviceModel } from "@api/device/DeviceModel";
import { StaticDeviceModelDataSource } from "@internal/device-model/data/StaticDeviceModelDataSource";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { bleDeviceStubBuilder } from "@internal/transport/ble/model/BleDevice.stub";
import { bleDeviceConnectionFactoryStubBuilder } from "@internal/transport/ble/service/BleDeviceConnectionFactory.stub";
import {
  BleDeviceGattServerError,
  BleTransportNotSupportedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  UnknownDeviceError,
} from "@internal/transport/model/Errors";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";

import { WebBleTransport } from "./WebBleTransport";

jest.mock("@internal/logger-publisher/service/LoggerPublisherService");

// Our StaticDeviceModelDataSource can directly be used in our unit tests
const bleDeviceModelDataSource = new StaticDeviceModelDataSource();
const logger = new DefaultLoggerPublisherService([], "web-ble");

const stubDevice: BluetoothDevice = bleDeviceStubBuilder();

describe("WebBleTransport", () => {
  let transport: WebBleTransport;

  beforeEach(() => {
    transport = new WebBleTransport(
      bleDeviceModelDataSource,
      () => logger,
      bleDeviceConnectionFactoryStubBuilder(),
    );
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const discoverDevice = (
    onSuccess: (discoveredDevice: InternalDiscoveredDevice) => void,
    onError?: (error: unknown) => void,
  ) => {
    transport.startDiscovering().subscribe({
      next: onSuccess,
      error: onError,
    });
  };

  describe("When Web bluetooth API is not supported", () => {
    it("should not support the transport", () => {
      expect(transport.isSupported()).toBe(false);
    });

    it("should emit a startDiscovering error", (done) => {
      discoverDevice(
        () => {
          done("Should not emit any value");
        },
        (error) => {
          expect(error).toBeInstanceOf(BleTransportNotSupportedError);
          done();
        },
      );
    });
  });

  describe("When Web Bluetooth API is supported", () => {
    const mockedRequestDevice = jest.fn();

    beforeAll(() => {
      global.navigator = {
        bluetooth: {
          requestDevice: mockedRequestDevice,
        },
      } as unknown as Navigator;
    });

    afterAll(() => {
      jest.restoreAllMocks();
      global.navigator = undefined as unknown as Navigator;
    });

    it("should support the transport", () => {
      expect(transport.isSupported()).toBe(true);
    });

    describe("startDiscovering", () => {
      it("should emit device if one new grant access", (done) => {
        mockedRequestDevice.mockResolvedValueOnce(stubDevice);

        discoverDevice(
          (discoveredDevice) => {
            try {
              expect(discoveredDevice).toEqual(
                expect.objectContaining({
                  deviceModel: expect.objectContaining({
                    id: "nanoX",
                    productName: "Ledger Nano X",
                  }) as DeviceModel,
                }),
              );

              done();
            } catch (expectError) {
              done(expectError);
            }
          },
          (error) => {
            done(error);
          },
        );
      });

      it("should throw DeviceNotRecognizedError if the device is not recognized", (done) => {
        mockedRequestDevice.mockResolvedValueOnce({
          ...stubDevice,
          gatt: {
            ...stubDevice.gatt,
            getPrimaryServices: jest.fn(() => Promise.resolve([])),
          },
          productId: 0x4242,
        });

        discoverDevice(
          () => {
            done("should not return a device");
          },
          (error) => {
            expect(error).toBeInstanceOf(BleDeviceGattServerError);
            done();
          },
        );
      });

      it("should emit an error if the request device is in error", (done) => {
        const message = "request device error";
        mockedRequestDevice.mockImplementationOnce(() => {
          throw new Error(message);
        });

        discoverDevice(
          () => {
            done("should not return a device");
          },
          (error) => {
            expect(error).toBeInstanceOf(NoAccessibleDeviceError);
            expect(error).toStrictEqual(
              new NoAccessibleDeviceError(new Error(message)),
            );
            done();
          },
        );
      });

      it("should emit an error if the user did not grant us access to a device (clicking on cancel on the browser popup for ex)", (done) => {
        mockedRequestDevice.mockResolvedValueOnce({});

        discoverDevice(
          (discoveredDevice) => {
            done(
              `Should not emit any value, but emitted ${JSON.stringify(
                discoveredDevice,
              )}`,
            );
          },
          (error) => {
            try {
              expect(error).toBeInstanceOf(BleDeviceGattServerError);
              done();
            } catch (expectError) {
              done(expectError);
            }
          },
        );
      });
    });

    describe("stopDiscovering", () => {
      it("should stop monitoring connections if the discovery process is halted", () => {
        const abortSpy = jest.spyOn(AbortController.prototype, "abort");

        transport.stopDiscovering();

        expect(abortSpy).toHaveBeenCalled();
      });
    });

    describe("connect", () => {
      it("should throw UnknownDeviceError if no internal device", async () => {
        const connectParams = {
          deviceId: "fake",
          onDisconnect: jest.fn(),
        };

        const connect = await transport.connect(connectParams);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError("Unknown device fake")),
        );
      });

      it("should throw OpeningConnectionError if the device is already opened", async () => {
        const device = {
          deviceId: "fake",
          onDisconnect: jest.fn(),
        };

        const connect = await transport.connect(device);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError("Unknown device fake")),
        );
      });

      it("should throw OpeningConnectionError if the device cannot be opened", (done) => {
        const message = "cannot be opened";
        mockedRequestDevice.mockResolvedValueOnce({
          ...stubDevice,
          gatt: {
            connect: () => {
              throw new Error(message);
            },
          },
        });

        discoverDevice(
          () => {
            done();
          },
          (error) => {
            expect(error).toBeInstanceOf(OpeningConnectionError);
            done();
          },
        );
      });

      it("should return the opened device", (done) => {
        mockedRequestDevice.mockResolvedValueOnce({
          ...stubDevice,
          gatt: {
            ...stubDevice.gatt,
            connected: true,
            connect: () => {
              throw new DOMException("already opened", "InvalidStateError");
            },
          },
        });

        discoverDevice(
          (discoveredDevice) => {
            transport
              .connect({
                deviceId: discoveredDevice.id,
                onDisconnect: jest.fn(),
              })
              .then((connectedDevice) => {
                connectedDevice
                  .ifRight((device) => {
                    expect(device).toEqual(
                      expect.objectContaining({ id: discoveredDevice.id }),
                    );
                    done();
                  })
                  .ifLeft(() => {
                    done(connectedDevice);
                  });
              })
              .catch((error) => {
                done(error);
              });
          },
          (error) => {
            done(error);
          },
        );
      });

      it("should return a device if available", (done) => {
        mockedRequestDevice.mockResolvedValueOnce(stubDevice);

        discoverDevice(
          (discoveredDevice) => {
            transport
              .connect({
                deviceId: discoveredDevice.id,
                onDisconnect: jest.fn(),
              })
              .then((connectedDevice) => {
                connectedDevice
                  .ifRight((device) => {
                    expect(device).toEqual(
                      expect.objectContaining({ id: discoveredDevice.id }),
                    );
                    done();
                  })
                  .ifLeft(() => {
                    done(connectedDevice);
                  });
              })
              .catch((error) => {
                done(error);
              });
          },
          (error) => {
            done(error);
          },
        );
      });
    });
  });
});

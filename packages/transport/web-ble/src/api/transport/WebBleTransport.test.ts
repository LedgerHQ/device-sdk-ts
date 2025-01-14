import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  ConnectError,
  type DeviceModel,
  type LoggerPublisherService,
  type LoggerSubscriberService,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  StaticDeviceModelDataSource,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { Either, Left, Right } from "purify-ts";

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/WebBleConfig";
import { bleDeviceStubBuilder } from "@api/model/BleDevice.stub";
import { BleTransportNotSupportedError } from "@api/model/Errors";
import { BleDeviceGattServerError } from "@api/model/Errors";

import { WebBleTransport } from "./WebBleTransport";

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

// Our StaticDeviceModelDataSource can directly be used in our unit tests
const bleDeviceModelDataSource = new StaticDeviceModelDataSource();
const logger = new LoggerPublisherServiceStub([], "web-ble");

const stubDevice: BluetoothDevice = bleDeviceStubBuilder();

describe("WebBleTransport", () => {
  let transport: WebBleTransport;
  let apduReceiverServiceFactoryStub: ApduReceiverServiceFactory;
  let apduSenderServiceFactoryStub: ApduSenderServiceFactory;

  beforeEach(() => {
    apduReceiverServiceFactoryStub = vi.fn();
    apduSenderServiceFactoryStub = vi.fn();
    transport = new WebBleTransport(
      bleDeviceModelDataSource,
      () => logger,
      apduSenderServiceFactoryStub,
      apduReceiverServiceFactoryStub,
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const discoverDevice = (
    onSuccess: (discoveredDevice: TransportDiscoveredDevice) => void,
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

    it("should emit a startDiscovering error", () =>
      new Promise<string | void>((done) => {
        discoverDevice(
          () => {
            done("Should not emit any value");
          },
          (error) => {
            expect(error).toBeInstanceOf(BleTransportNotSupportedError);
            done();
          },
        );
      }));
  });

  describe("When Web Bluetooth API is supported", () => {
    const mockedRequestDevice = vi.fn();

    beforeAll(() => {
      global.navigator = {
        bluetooth: {
          requestDevice: mockedRequestDevice,
        },
      } as unknown as Navigator;
    });

    afterAll(() => {
      vi.restoreAllMocks();
      global.navigator = undefined as unknown as Navigator;
    });

    it("should support the transport", () => {
      expect(transport.isSupported()).toBe(true);
    });

    describe("startDiscovering", () => {
      it("should emit device if one new grant access", () =>
        new Promise<string | Error | void>((done) => {
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
                done(expectError as Error);
              }
            },
            (error) => {
              done(error as Error);
            },
          );
        }));

      it("should throw DeviceNotRecognizedError if the device is not recognized", () =>
        new Promise<string | void>((done) => {
          mockedRequestDevice.mockResolvedValueOnce({
            ...stubDevice,
            gatt: {
              ...stubDevice.gatt,
              getPrimaryServices: vi.fn(() => Promise.resolve([])),
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
        }));

      it("should emit an error if the request device is in error", () =>
        new Promise<string | void>((done) => {
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
        }));

      it("should emit an error if the user did not grant us access to a device (clicking on cancel on the browser popup for ex)", () =>
        new Promise<string | Error | void>((done) => {
          mockedRequestDevice.mockResolvedValueOnce({ forget: vi.fn() });

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
                done(expectError as Error);
              }
            },
          );
        }));
    });

    describe("connect", () => {
      it("should throw UnknownDeviceError if no internal device", async () => {
        const connectParams = {
          deviceId: "fake",
          onDisconnect: vi.fn(),
        };

        const connect = await transport.connect(connectParams);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError("Unknown device fake")),
        );
      });

      it("should throw OpeningConnectionError if the device is already opened", async () => {
        const device = {
          deviceId: "fake",
          onDisconnect: vi.fn(),
        };

        const connect = await transport.connect(device);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError("Unknown device fake")),
        );
      });

      it("should throw OpeningConnectionError if the device cannot be opened", () =>
        new Promise<void>((done) => {
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
        }));

      it("should return the opened device", () =>
        new Promise<
          Either<ConnectError, TransportConnectedDevice> | Error | void
        >((done) => {
          mockedRequestDevice.mockResolvedValueOnce({
            ...stubDevice,
            gatt: {
              ...stubDevice.gatt,
              connected: true,
            },
          });

          discoverDevice(
            (discoveredDevice) => {
              transport
                .connect({
                  deviceId: discoveredDevice.id,
                  onDisconnect: vi.fn(),
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
              done(error as Error);
            },
          );
        }));

      it("should return a device if available", () =>
        new Promise<
          Either<ConnectError, TransportConnectedDevice> | Error | void
        >((done) => {
          mockedRequestDevice.mockResolvedValueOnce(stubDevice);

          discoverDevice(
            (discoveredDevice) => {
              transport
                .connect({
                  deviceId: discoveredDevice.id,
                  onDisconnect: vi.fn(),
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
              done(error as Error);
            },
          );
        }));
    });

    describe("disconnect", () => {
      it("should disconnect the device", () =>
        new Promise<Error | void>((done) => {
          mockedRequestDevice.mockResolvedValueOnce(stubDevice);

          const onDisconnect = vi.fn();

          discoverDevice(
            (discoveredDevice) => {
              transport
                .connect({
                  deviceId: discoveredDevice.id,
                  onDisconnect,
                })
                .then((connectedDevice) => {
                  connectedDevice.ifRight((device) => {
                    transport
                      .disconnect({ connectedDevice: device })
                      .then((value) => {
                        expect(value).toStrictEqual(Right(void 0));
                        done();
                      })
                      .catch((error) => {
                        done(error);
                      });
                  });
                });
            },
            (error) => {
              done(error as Error);
            },
          );
        }));

      it("should call disconnect handler if device is hardware disconnected", () =>
        new Promise<Error | void>((done) => {
          const onDisconnect = vi.fn();
          const disconnectSpy = vi.spyOn(transport, "disconnect");
          mockedRequestDevice.mockResolvedValueOnce(stubDevice);

          discoverDevice(
            (discoveredDevice) => {
              transport
                .connect({
                  deviceId: discoveredDevice.id,
                  onDisconnect,
                })
                .then(() => {
                  stubDevice.ongattserverdisconnected(new Event(""));
                  vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
                  expect(disconnectSpy).toHaveBeenCalled();
                  done();
                });
            },
            (error) => {
              done(error as Error);
            },
          );
        }));
    });

    describe("reconnect", () => {
      it("should not call disconnection if reconnection happen", () =>
        new Promise<Error | void>((done) => {
          // given
          const onDisconnect = vi.fn();
          const disconnectSpy = vi.spyOn(transport, "disconnect");
          mockedRequestDevice.mockResolvedValueOnce(stubDevice);

          // when
          discoverDevice((discoveredDevice) => {
            transport
              .connect({
                deviceId: discoveredDevice.id,
                onDisconnect,
              })
              .then(() => {
                stubDevice.ongattserverdisconnected(new Event(""));

                vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

                // then
                expect(disconnectSpy).toHaveBeenCalledTimes(0);
                done();
              })
              .catch((error) => {
                done(error);
              });
          });
        }));
    });
  });
});

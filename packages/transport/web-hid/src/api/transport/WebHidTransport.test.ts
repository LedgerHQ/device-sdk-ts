/* eslint @typescript-eslint/consistent-type-imports: off */
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  connectedDeviceStubBuilder,
  type DeviceModel,
  DeviceModelId,
  DeviceNotRecognizedError,
  type LoggerPublisherService,
  type LoggerSubscriberService,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  StaticDeviceModelDataSource,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { Subject } from "rxjs";

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/WebHidConfig";
import { WebHidTransportNotSupportedError } from "@api/model/Errors";
import { hidDeviceStubBuilder } from "@api/model/HIDDevice.stub";

import { WebHidTransport } from "./WebHidTransport";

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

// Our StaticDeviceModelDataSource can directly be used in our unit tests
const usbDeviceModelDataSource = new StaticDeviceModelDataSource();
const logger = new LoggerPublisherServiceStub([], "web-usb-hid");

const stubDevice: HIDDevice = hidDeviceStubBuilder();

/**
 * Flushes all pending promises
 */
const flushPromises = async () => {
  const timers = await vi.importActual<typeof import("timers")>("timers");
  return new Promise(timers.setImmediate);
};

describe("WebHidTransport", () => {
  let transport: WebHidTransport;
  let apduReceiverServiceFactoryStub: ApduReceiverServiceFactory;
  let apduSenderServiceFactoryStub: ApduSenderServiceFactory;

  function initializeTransport() {
    apduReceiverServiceFactoryStub = vi.fn();
    apduSenderServiceFactoryStub = vi.fn();
    transport = new WebHidTransport(
      usbDeviceModelDataSource,
      () => logger,
      apduSenderServiceFactoryStub,
      apduReceiverServiceFactoryStub,
    );
  }

  beforeEach(() => {
    initializeTransport();
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

  describe("When WebHID API is not supported", () => {
    it("should not support the transport", () => {
      expect(transport.isSupported()).toBe(false);
    });

    it("should emit a startDiscovering error", () =>
      new Promise<void>((resolve, reject) => {
        discoverDevice(
          () => {
            reject("Should not emit any value");
          },
          (error) => {
            expect(error).toBeInstanceOf(WebHidTransportNotSupportedError);
            resolve();
          },
        );
      }));
  });

  describe("When WebHID API is supported", () => {
    const mockedGetDevices = vi.fn();
    const mockedRequestDevice = vi.fn();

    const connectionEventsSubject = new Subject<HIDConnectionEvent>();
    const disconnectionEventsSubject = new Subject<HIDConnectionEvent>();

    function emitHIDConnectionEvent(device: HIDDevice) {
      connectionEventsSubject.next({
        device,
      } as HIDConnectionEvent);
    }

    function emitHIDDisconnectionEvent(device: HIDDevice) {
      disconnectionEventsSubject.next({
        device,
      } as HIDConnectionEvent);
    }

    beforeEach(() => {
      global.navigator = {
        hid: {
          getDevices: mockedGetDevices,
          requestDevice: mockedRequestDevice,
          addEventListener: (
            eventName: string,
            callback: (event: HIDConnectionEvent) => void,
          ) => {
            if (eventName === "disconnect") {
              disconnectionEventsSubject.subscribe(callback);
            } else if (eventName === "connect") {
              connectionEventsSubject.subscribe(callback);
            }
          },
        },
      } as unknown as Navigator;
      initializeTransport();
    });

    afterEach(() => {
      vi.clearAllMocks();
      global.navigator = undefined as unknown as Navigator;
    });

    it("should support the transport", () => {
      expect(transport.isSupported()).toBe(true);
    });

    describe("startDiscovering", () => {
      const testCases = usbDeviceModelDataSource
        .getAllDeviceModels()
        .flatMap((deviceModel) => {
          return [
            {
              testTitle: `should emit device if user grants access through hid.requestDevice (${deviceModel.productName})`,
              hidDevice: hidDeviceStubBuilder({
                productId: deviceModel.usbProductId << 8,
                productName: deviceModel.productName,
              }),
              expectedDeviceModel: deviceModel,
            },
            {
              testTitle: `should emit device if user grants access through hid.requestDevice (${deviceModel.productName}, bootloader)`,
              hidDevice: hidDeviceStubBuilder({
                productId: deviceModel.bootloaderUsbProductId,
                productName: deviceModel.productName,
              }),
              expectedDeviceModel: deviceModel,
            },
          ];
        });

      testCases.forEach((testCase) => {
        it(
          testCase.testTitle,
          () =>
            new Promise<void>((resolve, reject) => {
              mockedRequestDevice.mockResolvedValueOnce([testCase.hidDevice]);

              discoverDevice(
                (discoveredDevice) => {
                  try {
                    expect(discoveredDevice).toEqual(
                      expect.objectContaining({
                        deviceModel: testCase.expectedDeviceModel,
                      }),
                    );

                    resolve();
                  } catch (expectError) {
                    reject(expectError as Error);
                  }
                },
                (error) => {
                  reject(error as Error);
                },
              );
            }),
        );
      });

      // It does not seem possible for a user to select several devices on the browser popup.
      // But if it was possible, we should emit them
      it("should emit devices if new grant accesses", () =>
        new Promise<void>((resolve, reject) => {
          mockedRequestDevice.mockResolvedValueOnce([
            stubDevice,
            {
              ...stubDevice,
              productId: 0x5011,
              productName: "Ledger Nano S Plus",
            },
          ]);

          let count = 0;
          discoverDevice(
            (discoveredDevice) => {
              try {
                switch (count) {
                  case 0:
                    expect(discoveredDevice).toEqual(
                      expect.objectContaining({
                        deviceModel: expect.objectContaining({
                          id: DeviceModelId.NANO_X,
                          productName: "Ledger Nano X",
                          usbProductId: 0x40,
                        }) as DeviceModel,
                      }),
                    );
                    break;
                  case 1:
                    expect(discoveredDevice).toEqual(
                      expect.objectContaining({
                        deviceModel: expect.objectContaining({
                          id: DeviceModelId.NANO_SP,
                          productName: "Ledger Nano S Plus",
                          usbProductId: 0x50,
                        }) as DeviceModel,
                      }),
                    );

                    resolve();
                    break;
                }

                count++;
              } catch (expectError) {
                reject(expectError as Error);
              }
            },
            (error) => {
              reject(error as Error);
            },
          );
        }));

      it("should throw DeviceNotRecognizedError if the device is not recognized", () =>
        new Promise<void>((resolve, reject) => {
          mockedRequestDevice.mockResolvedValueOnce([
            {
              ...stubDevice,
              productId: 0x4242,
            },
          ]);

          discoverDevice(
            () => {
              reject("should not return a device");
            },
            (error) => {
              expect(error).toBeInstanceOf(DeviceNotRecognizedError);
              resolve();
            },
          );
        }));

      it("should emit an error if the request device is in error", () =>
        new Promise<void>((resolve, reject) => {
          const message = "request device error";
          mockedRequestDevice.mockImplementationOnce(() => {
            throw new Error(message);
          });

          discoverDevice(
            () => {
              reject("should not return a device");
            },
            (error) => {
              expect(error).toBeInstanceOf(NoAccessibleDeviceError);
              expect(error).toStrictEqual(
                new NoAccessibleDeviceError(new Error(message)),
              );
              resolve();
            },
          );
        }));

      // [ASK] Is this the behavior we want when the user does not select any device ?
      it("should emit an error if the user did not grant us access to a device (clicking on cancel on the browser popup for ex)", () =>
        new Promise<void>((resolve, reject) => {
          // When the user does not select any device, the `requestDevice` will return an empty array
          mockedRequestDevice.mockResolvedValueOnce([]);

          discoverDevice(
            (discoveredDevice) => {
              reject(
                `Should not emit any value, but emitted ${JSON.stringify(
                  discoveredDevice,
                )}`,
              );
            },
            (error) => {
              try {
                expect(error).toBeInstanceOf(NoAccessibleDeviceError);
                resolve();
              } catch (expectError) {
                reject(expectError as Error);
              }
            },
          );
        }));

      it("should emit the same discoveredDevice object if its discovered twice in a row", async () => {
        mockedRequestDevice.mockResolvedValue([stubDevice]);
        mockedGetDevices.mockResolvedValue([stubDevice]);

        const firstDiscoveredDevice = await new Promise<void>(
          (resolve, reject) => {
            discoverDevice(
              () => resolve(),
              (err) => reject(err),
            );
          },
        );
        const secondDiscoveredDevice = await new Promise<void>(
          (resolve, reject) => {
            discoverDevice(
              () => resolve(),
              (err) => reject(err),
            );
          },
        );
        expect(secondDiscoveredDevice).toBe(firstDiscoveredDevice);
      });
    });

    describe("destroy", () => {
      it("should stop monitoring connections if the discovery process is halted", () => {
        const abortSpy = vi.spyOn(AbortController.prototype, "abort");

        transport.destroy();

        expect(abortSpy).toHaveBeenCalled();
      });
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
        new Promise<void>((resolve, reject) => {
          const message = "cannot be opened";
          const mockedDevice = {
            ...stubDevice,
            open: () => {
              throw new Error(message);
            },
          };
          mockedRequestDevice.mockResolvedValueOnce([mockedDevice]);
          mockedGetDevices.mockResolvedValue([mockedDevice]);

          discoverDevice(
            (discoveredDevice) => {
              transport
                .connect({
                  deviceId: discoveredDevice.id,
                  onDisconnect: vi.fn(),
                })
                .then((value) => {
                  expect(value).toStrictEqual(
                    Left(new OpeningConnectionError(new Error(message))),
                  );
                  resolve();
                })
                .catch((error) => {
                  reject(error);
                });
            },
            (error) => {
              reject(error as Error);
            },
          );
        }));

      it("should return the opened device", () =>
        new Promise<void>((resolve, reject) => {
          const mockedDevice = {
            ...stubDevice,
            opened: false,
            open: () => {
              mockedDevice.opened = true;
              return Promise.resolve();
            },
          };

          mockedRequestDevice.mockResolvedValue([mockedDevice]);
          mockedGetDevices.mockResolvedValue([mockedDevice]);

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
                      resolve();
                    })
                    .ifLeft(() => {
                      reject(connectedDevice);
                    });
                })
                .catch((error) => {
                  reject(error);
                });
            },
            (error) => {
              reject(error as Error);
            },
          );
        }));

      it("should return a device if available", () =>
        new Promise<void>((resolve, reject) => {
          mockedRequestDevice.mockResolvedValueOnce([stubDevice]);
          mockedGetDevices.mockResolvedValue([stubDevice]);

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
                      resolve();
                    })
                    .ifLeft(() => {
                      reject(connectedDevice);
                    });
                })
                .catch((error) => {
                  reject(error);
                });
            },
            (error) => {
              reject(error as Error);
            },
          );
        }));
    });

    describe("disconnect", () => {
      it("should throw an error if the device is not connected", async () => {
        // given
        const connectedDevice = connectedDeviceStubBuilder();

        // when
        const disconnect = await transport.disconnect({
          connectedDevice,
        });

        expect(disconnect).toStrictEqual(
          Left(new UnknownDeviceError(`Unknown device ${connectedDevice.id}`)),
        );
      });

      it("should disconnect if the device is connected", () =>
        new Promise<void>((resolve, reject) => {
          mockedRequestDevice.mockResolvedValueOnce([stubDevice]);
          mockedGetDevices.mockResolvedValue([stubDevice]);

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
                      transport
                        .disconnect({ connectedDevice: device })
                        .then((value) => {
                          expect(value).toStrictEqual(Right(undefined));
                          resolve();
                        })
                        .catch((error) => {
                          reject(error);
                        });
                    })
                    .ifLeft(() => {
                      reject(connectedDevice);
                    });
                })
                .catch((error) => {
                  reject(error);
                });
            },
            (error) => {
              reject(error as Error);
            },
          );
        }));

      it("should call disconnect handler if a connected device is unplugged", () =>
        new Promise<void>((resolve, reject) => {
          // given
          const onDisconnect = vi.fn();
          mockedRequestDevice.mockResolvedValueOnce([stubDevice]);
          mockedGetDevices.mockResolvedValue([stubDevice]);

          // when
          transport.startDiscovering().subscribe({
            next: (discoveredDevice) => {
              const mock = {
                sendApdu: vi.fn(),
                device: stubDevice,
                deviceId: discoveredDevice.id,
                disconnect: onDisconnect,
                lostConnection: vi.fn().mockImplementation(() => {
                  setTimeout(() => {
                    mock.disconnect();
                  }, RECONNECT_DEVICE_TIMEOUT);
                }),
              };

              transport
                .connect({
                  deviceId: discoveredDevice.id,
                  onDisconnect,
                })
                .then(async () => {
                  emitHIDDisconnectionEvent(stubDevice);

                  expect(stubDevice.close).toHaveBeenCalled();
                  await Promise.resolve(); // wait for the next tick so the stubDevice.close promise is resolved
                  expect(onDisconnect).not.toHaveBeenCalled();
                  vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 2);
                  expect(onDisconnect).not.toHaveBeenCalled();
                  vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 2);
                  expect(onDisconnect).toHaveBeenCalled();
                  resolve();
                })
                .catch((error) => {
                  reject(error);
                });
            },
          });
        }));
    });

    describe("reconnect", () => {
      it("should stop disconnection if reconnection happen", () =>
        new Promise<void>((resolve, reject) => {
          // given
          const onDisconnect = vi.fn();

          const hidDevice1 = hidDeviceStubBuilder();
          const hidDevice2 = hidDeviceStubBuilder();

          mockedRequestDevice.mockResolvedValueOnce([hidDevice1]);
          mockedGetDevices.mockResolvedValue([hidDevice1, hidDevice2]);

          discoverDevice(async (discoveredDevice) => {
            const mock = {
              sendApdu: vi.fn(),
              device: hidDevice2,
              deviceId: discoveredDevice.id,
              disconnect: onDisconnect,
              lostConnection: vi.fn().mockImplementation(() => {
                setTimeout(() => {
                  mock.disconnect();
                }, RECONNECT_DEVICE_TIMEOUT);
              }),
            };

            try {
              await transport.connect({
                deviceId: discoveredDevice.id,
                onDisconnect,
              });

              /* Disconnection */
              emitHIDDisconnectionEvent(hidDevice1);
              expect(hidDevice1.close).toHaveBeenCalled();
              await Promise.resolve(); // wait for the next tick so the hidDevice1.close promise is resolved

              vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

              /* Reconnection */
              emitHIDConnectionEvent(hidDevice2);

              expect(hidDevice2.open).toHaveBeenCalled();
              await Promise.resolve(); // wait for the next tick so the hidDevice2.open promise is resolved

              vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
              expect(onDisconnect).not.toHaveBeenCalled();
              resolve();
            } catch (error) {
              reject(error as Error);
            }
          });
        }));

      it("should be able to reconnect twice in a row if the device is unplugged and replugged twice", () =>
        new Promise<void>((resolve, reject) => {
          // given
          const onDisconnect = vi.fn();

          const hidDevice1 = hidDeviceStubBuilder();
          const hidDevice2 = hidDeviceStubBuilder();
          const hidDevice3 = hidDeviceStubBuilder();

          mockedRequestDevice.mockResolvedValueOnce([hidDevice1]);
          mockedGetDevices.mockResolvedValue([
            hidDevice1,
            hidDevice2,
            hidDevice3,
          ]);

          // when
          discoverDevice(async (discoveredDevice) => {
            await transport.connect({
              deviceId: discoveredDevice.id,
              onDisconnect,
            });
            try {
              /* First disconnection */
              emitHIDDisconnectionEvent(hidDevice1);
              expect(hidDevice1.close).toHaveBeenCalled();
              await Promise.resolve(); // wait for the next tick so the hidDevice1.close promise is resolved
              vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

              /* First reconnection */
              emitHIDConnectionEvent(hidDevice2);

              expect(hidDevice2.open).toHaveBeenCalled();
              await Promise.resolve(); // wait for the next tick so the hidDevice2.open promise is resolved
              vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
              expect(onDisconnect).not.toHaveBeenCalled();

              /* Second disconnection */
              emitHIDDisconnectionEvent(hidDevice2);
              expect(hidDevice2.close).toHaveBeenCalled();
              await Promise.resolve(); // wait for the next tick so the hidDevice2.close promise is resolved
              vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

              /* Second reconnection */
              emitHIDConnectionEvent(hidDevice3);

              expect(hidDevice3.open).toHaveBeenCalled();
              await Promise.resolve(); // wait for the next tick so the hidDevice3.open promise is resolved
              vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
              expect(onDisconnect).not.toHaveBeenCalled();

              resolve();
            } catch (error) {
              reject(error as Error);
            }
          });
        }));
    });

    describe("Connection event typeguard", () => {
      it("should validate type of an HIDConnectionEvent", () => {
        // given
        const event = {
          device: stubDevice,
        } as HIDConnectionEvent;
        // when
        // @ts-expect-error trying to access private member
        const result = transport.isHIDConnectionEvent(event);
        // then
        expect(result).toBe(true);
      });

      it("should not validate type of another event", () => {
        // given
        const event = new Event("disconnect", {});
        // when
        // @ts-expect-error trying to access private member
        const result = transport.isHIDConnectionEvent(event);
        // then
        expect(result).toBe(false);
      });
    });

    describe("listenToAvailableDevices", () => {
      it("should emit the devices already connected before listening", async () => {
        // given
        const hidDevice = hidDeviceStubBuilder();
        mockedGetDevices.mockResolvedValue([hidDevice]);

        const onComplete = vi.fn();
        const onError = vi.fn();

        let observedDevices: TransportDiscoveredDevice[] = [];
        // when
        transport.listenToAvailableDevices().subscribe({
          next: (knownDevices) => {
            observedDevices = knownDevices;
          },
          complete: onComplete,
          error: onError,
        });

        await flushPromises();

        expect(observedDevices).toEqual([
          expect.objectContaining({
            deviceModel: expect.objectContaining({
              id: DeviceModelId.NANO_X,
            }) as TransportDeviceModel,
          }),
        ]);
        expect(onComplete).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
      });

      it("should emit the new list of devices after connection and disconnection events", async () => {
        initializeTransport();
        // given
        const hidDevice1 = hidDeviceStubBuilder({
          productId:
            usbDeviceModelDataSource.getDeviceModel({
              id: DeviceModelId.NANO_X,
            }).usbProductId << 8,
        });
        const hidDevice2 = hidDeviceStubBuilder({
          productId:
            usbDeviceModelDataSource.getDeviceModel({ id: DeviceModelId.STAX })
              .usbProductId << 8,
        });
        mockedGetDevices.mockResolvedValue([hidDevice1]);

        const onComplete = vi.fn();
        const onError = vi.fn();

        let observedDevices: TransportDiscoveredDevice[] = [];
        // when
        transport.listenToAvailableDevices().subscribe({
          next: (knownDevices) => {
            observedDevices = knownDevices;
          },
          complete: onComplete,
          error: onError,
        });

        await flushPromises();

        expect(observedDevices).toEqual([
          expect.objectContaining({
            deviceModel: expect.objectContaining({
              id: DeviceModelId.NANO_X,
            }) as TransportDeviceModel,
          }),
        ]);

        // When a new device is connected
        mockedGetDevices.mockResolvedValue([hidDevice1, hidDevice2]);
        emitHIDConnectionEvent(hidDevice2);
        await flushPromises();

        expect(observedDevices).toEqual([
          expect.objectContaining({
            deviceModel: expect.objectContaining({
              id: DeviceModelId.NANO_X,
            }) as TransportDeviceModel,
          }),
          expect.objectContaining({
            deviceModel: expect.objectContaining({
              id: DeviceModelId.STAX,
            }) as TransportDeviceModel,
          }),
        ]);

        // When a device is disconnected
        mockedGetDevices.mockResolvedValue([hidDevice2]);
        emitHIDDisconnectionEvent(hidDevice1);
        await flushPromises();

        expect(observedDevices).toEqual([
          expect.objectContaining({
            deviceModel: expect.objectContaining({
              id: DeviceModelId.STAX,
            }) as TransportDeviceModel,
          }),
        ]);

        expect(onComplete).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
      });

      it("should preserve DeviceId in case the device has been disconnected and reconnected before the timeout", async () => {
        // given
        const hidDevice = hidDeviceStubBuilder();

        mockedGetDevices.mockResolvedValue([hidDevice]);

        const onComplete = vi.fn();
        const onError = vi.fn();
        let observedDevices: TransportDiscoveredDevice[] = [];
        // when
        transport.listenToAvailableDevices().subscribe({
          next: (knownDevices) => {
            observedDevices = knownDevices;
          },
          complete: onComplete,
          error: onError,
        });

        await flushPromises();

        const firstObservedDeviceId = observedDevices[0]?.id;
        expect(firstObservedDeviceId).toBeTruthy();
        expect(observedDevices[0]?.deviceModel?.id).toBe(DeviceModelId.NANO_X);

        // Start a connection with the device
        await transport.connect({
          deviceId: observedDevices[0]!.id,
          onDisconnect: vi.fn(),
        });
        await flushPromises();

        // When the device is disconnected
        mockedGetDevices.mockResolvedValue([]);
        emitHIDDisconnectionEvent(hidDevice);
        await flushPromises();

        expect(observedDevices).toEqual([]);

        // When the device is reconnected
        mockedGetDevices.mockResolvedValue([hidDevice]);
        emitHIDConnectionEvent(hidDevice);
        await flushPromises();

        expect(observedDevices).toEqual([
          expect.objectContaining({
            deviceModel: expect.objectContaining({
              id: DeviceModelId.NANO_X,
            }) as TransportDeviceModel,
          }),
        ]);

        expect(observedDevices[0]?.id).toBeTruthy();
        expect(observedDevices[0]?.id).toBe(firstObservedDeviceId);
      });
    });
  });
});

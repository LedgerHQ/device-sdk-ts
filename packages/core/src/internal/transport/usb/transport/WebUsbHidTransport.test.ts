import { Left, Right } from "purify-ts";
import { Subject } from "rxjs";

import { DeviceModel, DeviceModelId } from "@api/device/DeviceModel";
import { StaticDeviceModelDataSource } from "@internal/device-model/data/StaticDeviceModelDataSource";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import {
  DeviceNotRecognizedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  UnknownDeviceError,
  UsbHidTransportNotSupportedError,
} from "@internal/transport/model/Errors";
import { connectedDeviceStubBuilder } from "@internal/transport/model/InternalConnectedDevice.stub";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";
import { RECONNECT_DEVICE_TIMEOUT } from "@internal/transport/usb/data/UsbHidConfig";
import { hidDeviceStubBuilder } from "@internal/transport/usb/model/HIDDevice.stub";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory.stub";

import { WebUsbHidTransport } from "./WebUsbHidTransport";

jest.mock("@internal/logger-publisher/service/LoggerPublisherService");

// Our StaticDeviceModelDataSource can directly be used in our unit tests
const usbDeviceModelDataSource = new StaticDeviceModelDataSource();
const logger = new DefaultLoggerPublisherService([], "web-usb-hid");

const stubDevice: HIDDevice = hidDeviceStubBuilder();

describe("WebUsbHidTransport", () => {
  let transport: WebUsbHidTransport;

  beforeEach(() => {
    transport = new WebUsbHidTransport(
      usbDeviceModelDataSource,
      () => logger,
      usbHidDeviceConnectionFactoryStubBuilder(),
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

  describe("When WebHID API is not supported", () => {
    it("should not support the transport", () => {
      expect(transport.isSupported()).toBe(false);
    });

    it("should emit a startDiscovering error", (done) => {
      discoverDevice(
        () => {
          done("Should not emit any value");
        },
        (error) => {
          expect(error).toBeInstanceOf(UsbHidTransportNotSupportedError);
          done();
        },
      );
    });
  });

  describe("When WebHID API is supported", () => {
    const mockedGetDevices = jest.fn();
    const mockedRequestDevice = jest.fn();

    const connectionEventsSubject = new Subject<HIDConnectionEvent>();
    const disconnectionEventsSubject = new Subject<HIDConnectionEvent>();

    function emitHIDConnectionEvent(device: HIDDevice) {
      if (global.navigator.hid.onconnect)
        global.navigator.hid.onconnect({ device } as HIDConnectionEvent);
      connectionEventsSubject.next({
        device,
      } as HIDConnectionEvent);
    }

    function emitHIDDisconnectionEvent(device: HIDDevice) {
      if (global.navigator.hid.ondisconnect)
        global.navigator.hid.ondisconnect({ device } as HIDConnectionEvent);
      disconnectionEventsSubject.next({
        device,
      } as HIDConnectionEvent);
    }

    beforeAll(() => {
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
    });

    afterAll(() => {
      jest.restoreAllMocks();
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
        it(testCase.testTitle, (done) => {
          mockedRequestDevice.mockResolvedValueOnce([testCase.hidDevice]);

          discoverDevice(
            (discoveredDevice) => {
              try {
                expect(discoveredDevice).toEqual(
                  expect.objectContaining({
                    deviceModel: testCase.expectedDeviceModel,
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
      });

      // It does not seem possible for a user to select several devices on the browser popup.
      // But if it was possible, we should emit them
      it("should emit devices if new grant accesses", (done) => {
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

                  done();
                  break;
              }

              count++;
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
        mockedRequestDevice.mockResolvedValueOnce([
          {
            ...stubDevice,
            productId: 0x4242,
          },
        ]);

        discoverDevice(
          () => {
            done("should not return a device");
          },
          (error) => {
            expect(error).toBeInstanceOf(DeviceNotRecognizedError);
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

      // [ASK] Is this the behavior we want when the user does not select any device ?
      it("should emit an error if the user did not grant us access to a device (clicking on cancel on the browser popup for ex)", (done) => {
        // When the user does not select any device, the `requestDevice` will return an empty array
        mockedRequestDevice.mockResolvedValueOnce([]);

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
              expect(error).toBeInstanceOf(NoAccessibleDeviceError);
              done();
            } catch (expectError) {
              done(expectError);
            }
          },
        );
      });

      it("should emit the same discoveredDevice object if its discovered twice in a row", async () => {
        mockedRequestDevice.mockResolvedValue([stubDevice]);

        const firstDiscoveredDevice = await new Promise((resolve, reject) => {
          discoverDevice(resolve, (err) => reject(err));
        });
        const secondDiscoveredDevice = await new Promise((resolve, reject) => {
          discoverDevice(resolve, (err) => reject(err));
        });
        expect(secondDiscoveredDevice).toBe(firstDiscoveredDevice);
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
        mockedRequestDevice.mockResolvedValueOnce([
          {
            ...stubDevice,
            open: () => {
              throw new Error(message);
            },
          },
        ]);

        discoverDevice(
          (discoveredDevice) => {
            transport
              .connect({
                deviceId: discoveredDevice.id,
                onDisconnect: jest.fn(),
              })
              .then((value) => {
                expect(value).toStrictEqual(
                  Left(new OpeningConnectionError(new Error(message))),
                );
                done();
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

      it("should return the opened device", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([
          {
            ...stubDevice,
            opened: true,
            open: () => {
              throw new DOMException("already opened", "InvalidStateError");
            },
          },
        ]);

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
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

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

      it("should disconnect if the device is connected", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

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
                    transport
                      .disconnect({ connectedDevice: device })
                      .then((value) => {
                        expect(value).toStrictEqual(Right(void 0));
                        done();
                      })
                      .catch((error) => {
                        done(error);
                      });
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

      it("should call disconnect handler if a connected device is unplugged", (done) => {
        // given
        const onDisconnect = jest.fn();
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

        // when
        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
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
                jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 2);
                expect(onDisconnect).not.toHaveBeenCalled();
                jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 2);
                expect(onDisconnect).toHaveBeenCalled();
                done();
              })
              .catch((error) => {
                done(error);
              });
          },
        });
      });
    });

    describe("reconnect", () => {
      it("should stop disconnection if reconnection happen", (done) => {
        // given
        const onDisconnect = jest.fn();

        const hidDevice1 = hidDeviceStubBuilder();
        const hidDevice2 = hidDeviceStubBuilder();

        mockedRequestDevice.mockResolvedValueOnce([hidDevice1]);

        discoverDevice(async (discoveredDevice) => {
          try {
            await transport.connect({
              deviceId: discoveredDevice.id,
              onDisconnect,
            });

            /* Disconnection */
            emitHIDDisconnectionEvent(hidDevice1);
            expect(hidDevice1.close).toHaveBeenCalled();
            await Promise.resolve(); // wait for the next tick so the hidDevice1.close promise is resolved

            jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

            /* Reconnection */
            emitHIDConnectionEvent(hidDevice2);

            expect(hidDevice2.open).toHaveBeenCalled();
            await Promise.resolve(); // wait for the next tick so the hidDevice2.open promise is resolved
            jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
            expect(onDisconnect).not.toHaveBeenCalled();
            done();
          } catch (error) {
            done(error);
          }
        });
      });

      it("should be able to reconnect twice in a row if the device is unplugged and replugged twice", (done) => {
        // given
        const onDisconnect = jest.fn();

        const hidDevice1 = hidDeviceStubBuilder();
        const hidDevice2 = hidDeviceStubBuilder();
        const hidDevice3 = hidDeviceStubBuilder();

        mockedRequestDevice.mockResolvedValueOnce([hidDevice1]);

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
            jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

            /* First reconnection */
            emitHIDConnectionEvent(hidDevice2);

            expect(hidDevice2.open).toHaveBeenCalled();
            await Promise.resolve(); // wait for the next tick so the hidDevice2.open promise is resolved
            jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
            expect(onDisconnect).not.toHaveBeenCalled();

            /* Second disconnection */
            emitHIDDisconnectionEvent(hidDevice2);
            expect(hidDevice2.close).toHaveBeenCalled();
            await Promise.resolve(); // wait for the next tick so the hidDevice2.close promise is resolved
            jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

            /* Second reconnection */
            emitHIDConnectionEvent(hidDevice3);

            expect(hidDevice3.open).toHaveBeenCalled();
            await Promise.resolve(); // wait for the next tick so the hidDevice3.open promise is resolved
            jest.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
            expect(onDisconnect).not.toHaveBeenCalled();

            done();
          } catch (error) {
            done(error);
          }
        });
      });
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
  });
});

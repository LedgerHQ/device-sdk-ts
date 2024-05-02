import { Left, Right } from "purify-ts";

import { DeviceModel, DeviceModelId } from "@api/device/DeviceModel";
import { StaticDeviceModelDataSource } from "@internal/device-model/data/StaticDeviceModelDataSource";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import {
  DeviceNotRecognizedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  UnknownDeviceError,
  UsbHidTransportNotSupportedError,
} from "@internal/usb/model/Errors";
import { hidDeviceStubBuilder } from "@internal/usb/model/HIDDevice.stub";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/usb/service/UsbHidDeviceConnectionFactory.stub";

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("When WebHID API is not supported", () => {
    it("should not support the transport", () => {
      expect(transport.isSupported()).toBe(false);
    });

    it("should emit a startDiscovering error", (done) => {
      transport.startDiscovering().subscribe({
        next: () => {
          done("Should not emit any value");
        },
        error: (error) => {
          expect(error).toBeInstanceOf(UsbHidTransportNotSupportedError);
          done();
        },
      });
    });
  });

  describe("When WebHID API is supported", () => {
    const mockedGetDevices = jest.fn();
    const mockedRequestDevice = jest.fn();

    beforeAll(() => {
      global.navigator = {
        hid: {
          getDevices: mockedGetDevices,
          requestDevice: mockedRequestDevice,
          addEventListener: jest.fn(),
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
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
            try {
              expect(discoveredDevice).toEqual(
                expect.objectContaining({
                  deviceModel: expect.objectContaining({
                    id: DeviceModelId.NANO_X,
                    productName: "Ledger Nano X",
                    usbProductId: 0x40,
                  }) as DeviceModel,
                }),
              );

              done();
            } catch (expectError) {
              done(expectError);
            }
          },
          error: (error) => {
            done(error);
          },
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
        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
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
          error: (error) => {
            done(error);
          },
        });
      });

      it("should throw DeviceNotRecognizedError if the device is not recognized", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([
          {
            ...stubDevice,
            productId: 0x4242,
          },
        ]);

        transport.startDiscovering().subscribe({
          next: () => {
            done("should not return a device");
          },
          error: (error) => {
            expect(error).toBeInstanceOf(DeviceNotRecognizedError);
            done();
          },
        });
      });

      it("should emit an error if the request device is in error", (done) => {
        const message = "request device error";
        mockedRequestDevice.mockImplementationOnce(() => {
          throw new Error(message);
        });

        transport.startDiscovering().subscribe({
          next: () => {
            done("should not return a device");
          },
          error: (error) => {
            expect(error).toBeInstanceOf(NoAccessibleDeviceError);
            expect(error).toStrictEqual(
              new NoAccessibleDeviceError(new Error(message)),
            );
            done();
          },
        });
      });

      // [ASK] Is this the behavior we want when the user does not select any device ?
      it("should emit an error if the user did not grant us access to a device (clicking on cancel on the browser popup for ex)", (done) => {
        // When the user does not select any device, the `requestDevice` will return an empty array
        mockedRequestDevice.mockResolvedValueOnce([]);

        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
            done(
              `Should not emit any value, but emitted ${JSON.stringify(
                discoveredDevice,
              )}`,
            );
          },
          error: (error) => {
            try {
              expect(error).toBeInstanceOf(NoAccessibleDeviceError);
              done();
            } catch (expectError) {
              done(expectError);
            }
          },
        });
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
        const device = { deviceId: "fake" };

        const connect = await transport.connect(device);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError(new Error("Unknown device fake"))),
        );
      });

      it("should throw OpeningConnectionError if the device is already opened", async () => {
        const device = { deviceId: "fake" };

        const connect = await transport.connect(device);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError(new Error("Unknown device fake"))),
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

        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
            transport
              .connect({ deviceId: discoveredDevice.id })
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
          error: (error) => {
            done(error);
          },
        });
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

        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
            transport
              .connect({ deviceId: discoveredDevice.id })
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
          error: (error) => {
            done(error);
          },
        });
      });

      it("should return a device if available", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
            transport
              .connect({ deviceId: discoveredDevice.id })
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
          error: (error) => {
            done(error);
          },
        });
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
          Left(
            new UnknownDeviceError(
              new Error(`Unknown device ${connectedDevice.id}`),
            ),
          ),
        );
      });

      it("should disconnect if the device is connected", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
            transport
              .connect({ deviceId: discoveredDevice.id })
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
          error: (error) => {
            done(error);
          },
        });
      });
    });
  });
});

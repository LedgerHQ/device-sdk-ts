/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Left } from "purify-ts";

import { StaticDeviceModelDataSource } from "@internal/device-model/data/StaticDeviceModelDataSource";
import { DeviceModelId } from "@internal/device-model/model/DeviceModel";
import { DefaultLoggerService } from "@internal/logger/service/DefaultLoggerService";
import {
  DeviceNotRecognizedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  UnknownDeviceError,
  UsbHidTransportNotSupportedError,
} from "@internal/usb/model/Errors";

import { WebUsbHidTransport } from "./WebUsbHidTransport";

jest.mock("../../../internal/logger/service/LoggerService");

// Our StaticDeviceModelDataSource can directly be used in our unit tests
const usbDeviceModelDataSource = new StaticDeviceModelDataSource();
const logger = new DefaultLoggerService([]);

const stubDevice = {
  opened: false,
  productId: 0x4011,
  vendorId: 0x2c97,
  productName: "Ledger Nano X",
  collections: [],
  open: jest.fn(),
};

describe("WebUsbHidTransport", () => {
  describe("When WebHID API is not supported", () => {
    test("isSupported should return false", () => {
      const transport = new WebUsbHidTransport(
        usbDeviceModelDataSource,
        logger,
      );
      expect(transport.isSupported()).toBe(false);
    });

    test("startDiscovering should emit an error", (done) => {
      const transport = new WebUsbHidTransport(
        usbDeviceModelDataSource,
        logger,
      );
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
      } as any;
    });

    afterAll(() => {
      jest.restoreAllMocks();
      global.navigator = undefined as any;
    });

    it("isSupported should return true", () => {
      const transport = new WebUsbHidTransport(
        usbDeviceModelDataSource,
        logger,
      );
      expect(transport.isSupported()).toBe(true);
    });

    describe("startDiscovering", () => {
      test("If the user grant us access to a device, we should emit it", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );
        transport.startDiscovering().subscribe({
          next: (discoveredDevice) => {
            try {
              expect(discoveredDevice).toEqual(
                expect.objectContaining({
                  deviceModel: expect.objectContaining({
                    id: DeviceModelId.NANO_X,
                    productName: "Ledger Nano X",
                    usbProductId: 0x40,
                  }),
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
      test("If the user grant us access to several devices, we should emit them", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([
          stubDevice,
          {
            ...stubDevice,
            productId: 0x5011,
            productName: "Ledger Nano S Plus",
          },
        ]);

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );

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
                      }),
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
                      }),
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

      test("If the device is not recognized, we should throw a DeviceNotRecognizedError", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([
          {
            ...stubDevice,
            productId: 0x4242,
          },
        ]);

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );
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

      test("If the request device is in error, we should return it", (done) => {
        const message = "request device error";
        mockedRequestDevice.mockImplementationOnce(() => {
          throw new Error(message);
        });

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );
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
      test("If the user did not grant us access to a device (clicking on cancel on the browser popup for ex), we should emit an error", (done) => {
        // When the user does not select any device, the `requestDevice` will return an empty array
        mockedRequestDevice.mockResolvedValueOnce([]);

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );
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
      test("If the discovery process is halted, we should stop monitoring connections.", () => {
        const abortSpy = jest.spyOn(AbortController.prototype, "abort");
        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );

        transport.stopDiscovering();

        expect(abortSpy).toHaveBeenCalled();
      });
    });

    // [SHOULD] Unit tests connect
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    describe("connect", () => {
      test("If no internal device, should throw UnknownDeviceError", async () => {
        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );
        const device = { deviceId: "fake" };

        const connect = await transport.connect(device);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError(new Error("Unknown device fake"))),
        );
      });

      test("If the device is already opened, should throw OpeningConnectionError", async () => {
        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );
        const device = { deviceId: "fake" };

        const connect = await transport.connect(device);

        expect(connect).toStrictEqual(
          Left(new UnknownDeviceError(new Error("Unknown device fake"))),
        );
      });

      test("If the device cannot be opened, should throw OpeningConnexionError", (done) => {
        const message = "cannot be opened";
        mockedRequestDevice.mockResolvedValueOnce([
          {
            ...stubDevice,
            open: () => {
              throw new Error(message);
            },
          },
        ]);

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );
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

      test("If the device is already opened, return it", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([
          {
            ...stubDevice,
            opened: true,
            open: () => {
              throw new DOMException("already opened", "InvalidStateError");
            },
          },
        ]);

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );

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

      test("If the device is available, return it", (done) => {
        mockedRequestDevice.mockResolvedValueOnce([stubDevice]);

        const transport = new WebUsbHidTransport(
          usbDeviceModelDataSource,
          logger,
        );

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
  });
});

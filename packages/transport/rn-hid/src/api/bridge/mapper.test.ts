import {
  ApduResponse,
  DeviceModelId,
  LogLevel,
  type LogParams,
  OpeningConnectionError,
  type SendApduResult,
  StaticDeviceModelDataSource,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { SendApduError } from "@api/transport/Errors";
import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";
import { type InternalConnectionResult } from "@api/transport/types";

import {
  mapNativeConnectionResultToConnectionResult,
  mapNativeDeviceConnectionLostToDeviceDisconnected,
  mapNativeDiscoveryDeviceToTransportDiscoveredDevice,
  mapNativeLedgerDeviceToDeviceModel,
  mapNativeSendApduResultToSendApduResult,
  mapNativeTransportLogToLog,
} from "./mapper";
import {
  type NativeDiscoveryDevice,
  type NativeInternalConnectionResult,
  type NativeLedgerDevice,
  type NativeLog,
  type NativeSendApduResult,
} from "./types";

describe("mapper", () => {
  const deviceModelDataSource = new StaticDeviceModelDataSource();

  describe("mapNativeLedgerDeviceToDeviceModel", () => {
    const testCases: Array<{
      nativeLedgerDevice: NativeLedgerDevice;
      deviceModel: TransportDeviceModel | null;
    }> = [
      {
        nativeLedgerDevice: {
          name: "NanoS",
          usbProductIdMask: "0x10",
        },
        deviceModel: deviceModelDataSource.getDeviceModel({
          id: DeviceModelId.NANO_S,
        }),
      },
      {
        nativeLedgerDevice: {
          name: "NanoX",
          usbProductIdMask: "0x40",
        },
        deviceModel: deviceModelDataSource.getDeviceModel({
          id: DeviceModelId.NANO_X,
        }),
      },
      {
        nativeLedgerDevice: {
          name: "NanoSPlus",
          usbProductIdMask: "0x50",
        },
        deviceModel: deviceModelDataSource.getDeviceModel({
          id: DeviceModelId.NANO_SP,
        }),
      },
      {
        nativeLedgerDevice: {
          name: "Stax",
          usbProductIdMask: "0x60",
        },
        deviceModel: deviceModelDataSource.getDeviceModel({
          id: DeviceModelId.STAX,
        }),
      },
      {
        nativeLedgerDevice: {
          name: "Flex",
          usbProductIdMask: "0x70",
        },
        deviceModel: deviceModelDataSource.getDeviceModel({
          id: DeviceModelId.FLEX,
        }),
      },
      {
        nativeLedgerDevice: {
          name: "NanoX",
          usbProductIdMask: "0x12345678",
        },
        deviceModel: null, // because the usbProductIdMask is not recognized
      },
    ];
    testCases.forEach(({ nativeLedgerDevice, deviceModel }) => {
      it(`should map USB device with usbProductIdMask ${nativeLedgerDevice.usbProductIdMask} to ${
        deviceModel?.productName ?? "null"
      }`, () => {
        expect(
          mapNativeLedgerDeviceToDeviceModel(
            nativeLedgerDevice,
            deviceModelDataSource,
          ),
        ).toEqual(deviceModel);
      });
    });
  });

  describe("mapNativeDiscoveryDeviceToTransportDiscoveredDevice", () => {
    it("should map NativeDiscoveryDevice to TransportDiscoveredDevice", () => {
      const nativeDevice: NativeDiscoveryDevice = {
        name: "NanoS",
        uid: "abcd",
        ledgerDevice: {
          name: "NanoS",
          usbProductIdMask: "0x10",
        },
      };
      const expectedDiscoveredDevice: TransportDiscoveredDevice = {
        id: "abcd",
        deviceModel: deviceModelDataSource.getDeviceModel({
          id: DeviceModelId.NANO_S,
        }),
        transport: TRANSPORT_IDENTIFIER,
        name: "NanoS",
      };
      expect(
        mapNativeDiscoveryDeviceToTransportDiscoveredDevice(
          nativeDevice,
          deviceModelDataSource,
        ),
      ).toEqual(expectedDiscoveredDevice);
    });

    it("should return null if the device model is not recognized", () => {
      const nativeDevice: NativeDiscoveryDevice = {
        name: "NanoX",
        uid: "efgh",
        ledgerDevice: {
          name: "NanoX",
          usbProductIdMask: "0x4567890", // some invalid value
        },
      };
      const expectedDiscoveredDevice = null; // because the usbProductIdMask is not recognized
      expect(
        mapNativeDiscoveryDeviceToTransportDiscoveredDevice(
          nativeDevice,
          deviceModelDataSource,
        ),
      ).toEqual(expectedDiscoveredDevice);
    });
  });

  describe("mapNativeTransportLogToLog", () => {
    const testCases: Array<{
      nativeLog: NativeLog;
      log: LogParams;
    }> = [
      {
        // debug
        nativeLog: {
          level: "debug",
          tag: "tag",
          message: "debug message",
          jsonPayload: { key: "value" },
          timestamp: "123456789",
        },
        log: [
          LogLevel.Debug,
          "debug message",
          {
            timestamp: 123456789,
            tag: "tag",
            data: { key: "value" },
          },
        ],
      },
      // info
      {
        nativeLog: {
          level: "info",
          tag: "tag",
          message: "info message",
          jsonPayload: { key: "value" },
          timestamp: "123456789",
        },
        log: [
          LogLevel.Info,
          "info message",
          {
            timestamp: 123456789,
            tag: "tag",
            data: { key: "value" },
          },
        ],
      },
      // error
      {
        nativeLog: {
          level: "error",
          tag: "tag",
          message: "error message",
          jsonPayload: { key: "value" },
          timestamp: "123456789",
        },
        log: [
          LogLevel.Error,
          "error message",
          {
            timestamp: 123456789,
            tag: "tag",
            data: { key: "value" },
          },
        ],
      },
      // warning
      {
        nativeLog: {
          level: "warning",
          tag: "tag",
          message: "warning message",
          jsonPayload: { key: "value" },
          timestamp: "123456789",
        },
        log: [
          LogLevel.Warning,
          "warning message",
          {
            timestamp: 123456789,
            tag: "tag",
            data: { key: "value" },
          },
        ],
      },
    ];

    testCases.forEach(({ nativeLog, log }) => {
      it(`should map NativeLog with level "${nativeLog.level}" to Log`, () => {
        expect(mapNativeTransportLogToLog(nativeLog)).toEqual(log);
      });
    });
  });

  describe("mapNativeConnectionResultToConnectionResult", () => {
    const testCases: Array<{
      nativeConnectionResult: NativeInternalConnectionResult;
      connectionResult: InternalConnectionResult;
      testTitle: string;
    }> = [
      {
        testTitle: "Success",
        nativeConnectionResult: {
          success: true,
          sessionId: "1234",
          ledgerDevice: {
            name: "NanoS",
            usbProductIdMask: "0x10",
          },
          deviceName: "NanoS",
        },
        connectionResult: Right({
          sessionId: "1234",
          transportDeviceModel: deviceModelDataSource.getDeviceModel({
            id: DeviceModelId.NANO_S,
          }),
        }),
      },
      {
        testTitle: "Failure",
        nativeConnectionResult: {
          success: false,
          error: "error message",
        },
        connectionResult: Left(new OpeningConnectionError("error message")),
      },
      {
        testTitle: "Unknown device model",
        nativeConnectionResult: {
          success: true,
          sessionId: "1234",
          ledgerDevice: {
            name: "NanoX",
            usbProductIdMask: "0x12345678",
          },
          deviceName: "NanoX",
        },
        connectionResult: Left(
          new OpeningConnectionError(
            "Could not find device model for the connected device with usbProductIdMask: 0x12345678",
          ),
        ),
      },
    ];

    testCases.forEach(
      ({ testTitle, nativeConnectionResult, connectionResult }) => {
        it(testTitle, () => {
          expect(
            mapNativeConnectionResultToConnectionResult(
              nativeConnectionResult,
              deviceModelDataSource,
            ),
          ).toEqual(connectionResult);
        });
      },
    );
  });

  describe("mapNativeSendApduResultToSendApduResult", () => {
    test("success", () => {
      const resultApduString = "AQIDkAA=";
      const nativeSendApduResult: NativeSendApduResult = {
        success: true,
        apdu: resultApduString,
      };
      const expectedSendApduResult: SendApduResult = Right(
        new ApduResponse({
          data: new Uint8Array([0x01, 0x02, 0x03]),
          statusCode: new Uint8Array([0x90, 0x00]),
        }),
      );
      expect(
        mapNativeSendApduResultToSendApduResult(nativeSendApduResult),
      ).toEqual(expectedSendApduResult);
    });

    test("failure", () => {
      const nativeSendApduResult: NativeSendApduResult = {
        success: false,
        error: "error message",
      };
      const expectedSendApduResult: SendApduResult = Left(
        new SendApduError("error message"),
      );
      expect(
        mapNativeSendApduResultToSendApduResult(nativeSendApduResult),
      ).toEqual(expectedSendApduResult);
    });
  });

  describe("mapNativeDeviceConnectionLostToDeviceDisconnected", () => {
    it("should map NativeDeviceConnectionLost to DeviceDisconnected", () => {
      const nativeDeviceConnectionLost = {
        id: "1234",
      };
      const expectedDeviceDisconnected = {
        sessionId: "1234",
      };
      expect(
        mapNativeDeviceConnectionLostToDeviceDisconnected(
          nativeDeviceConnectionLost,
        ),
      ).toEqual(expectedDeviceDisconnected);
    });
  });
});

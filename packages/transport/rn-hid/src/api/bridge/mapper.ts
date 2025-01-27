import {
  ApduResponse,
  type DeviceModelDataSource,
  FramerUtils,
  LogLevel,
  OpeningConnectionError,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { base64ToUint8Array } from "@api/helpers/uint8ArrayToBase64";
import { SendApduError } from "@api/transport/Errors";
import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";
import {
  type ConnectionResult,
  type Log,
  type SendApduResult,
} from "@api/transport/types";

import {
  type NativeDiscoveryDevice,
  type NativeInternalConnectionResult,
  type NativeLedgerDevice,
  type NativeLog,
  type NativeSendApduResult,
} from "./types";

export function mapNativeLedgerDeviceToDeviceModel(
  nativeLedgerDevice: NativeLedgerDevice,
  deviceModelDataSource: DeviceModelDataSource,
): TransportDeviceModel | null {
  return (
    deviceModelDataSource.filterDeviceModels({
      usbProductId: Number.parseInt(nativeLedgerDevice.usbProductIdMask, 16),
    })[0] ?? null
  );
}

export function mapNativeDiscoveryDeviceToTransportDiscoveredDevice(
  nativeDevice: NativeDiscoveryDevice,
  deviceModelDataSource: DeviceModelDataSource,
): TransportDiscoveredDevice | null {
  const deviceModel = mapNativeLedgerDeviceToDeviceModel(
    nativeDevice.ledgerDevice,
    deviceModelDataSource,
  );
  if (deviceModel == null) return null;

  return {
    id: nativeDevice.uid,
    deviceModel,
    transport: TRANSPORT_IDENTIFIER,
    name: nativeDevice.name,
  };
}

export function mapNativeTransportLogToLog(log: NativeLog): Log {
  let level: LogLevel;
  switch (log.level) {
    case "error":
      level = LogLevel.Error;
      break;
    case "warning":
      level = LogLevel.Warning;
      break;
    case "info":
      level = LogLevel.Info;
      break;
    case "debug":
      level = LogLevel.Debug;
      break;
    default:
      assertNever(log.level);
      level = LogLevel.Info;
      break;
  }
  return {
    level,
    message: log.message,
    tag: log.tag,
    jsonPayload: log.jsonPayload,
  };
}

function assertNever(x: never) {
  throw new Error("Unexpected object: " + x);
}

export function mapNativeConnectionResultToConnectionResult(
  result: NativeInternalConnectionResult,
  deviceModelDataSource: DeviceModelDataSource,
): ConnectionResult {
  if (result.success) {
    const transportDeviceModel = mapNativeLedgerDeviceToDeviceModel(
      result.ledgerDevice,
      deviceModelDataSource,
    );
    if (!transportDeviceModel)
      return Left(
        new OpeningConnectionError(
          "Could not find device model, is deviceModelDataSource provided ? This can be a mismatch due to the mapping of types between the Native module and the TS module.",
        ),
      );
    return Right({ sessionId: result.sessionId, transportDeviceModel });
  } else {
    return Left(new OpeningConnectionError(result.error));
  }
}

export function mapNativeSendApduResultToSendApduResult(
  result: NativeSendApduResult,
): SendApduResult {
  if (result.success) {
    const responseBytes = base64ToUint8Array(result.apdu);
    const data = FramerUtils.getFirstBytesFrom(
      responseBytes,
      responseBytes.length - 2,
    );
    const statusCode = FramerUtils.getLastBytesFrom(responseBytes, 2);
    return Right(new ApduResponse({ data, statusCode }));
  } else {
    return Left(new SendApduError(result.error));
  }
}

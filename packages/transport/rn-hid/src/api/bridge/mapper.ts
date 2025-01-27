import {
  type DeviceModelDataSource,
  LogLevel,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";

import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";
import { type Log } from "@api/transport/types";

import { type NativeDiscoveryDevice, type NativeLog } from "./types";

export function mapNativeDiscoveryDeviceToTransportDiscoveredDevice(
  nativeDevice: NativeDiscoveryDevice,
  deviceModelDataSource: DeviceModelDataSource,
): TransportDiscoveredDevice | null {
  const deviceModel = deviceModelDataSource.filterDeviceModels({
    usbProductId: Number.parseInt(
      nativeDevice.ledgerDevice.usbProductIdMask,
      16,
    ),
  })[0];
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

import {
  type DeviceModelDataSource,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";

import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";

import { type NativeDiscoveryDevice } from "./types";

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

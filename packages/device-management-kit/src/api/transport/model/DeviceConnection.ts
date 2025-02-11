import { type Either } from "purify-ts";

import { type DeviceId } from "@api/device/DeviceModel";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type DmkError } from "@api/Error";

export type DisconnectHandler = (deviceId: DeviceId) => void;

export type SendApduFnType = (
  apdu: Uint8Array,
  triggersDisconnection?: boolean,
) => Promise<Either<DmkError, ApduResponse>>;

export interface DeviceConnection {
  sendApdu: SendApduFnType;
}

/**
 * DeviceConnection is a generic interface that represents a connection to a device.
 * It is used to send APDUs to the device.
 *
 * @template Dependencies the object containing all the logic necessary to
 * implement sendApdu. For instance HIDDevice or onWrite on RN BLE.
 *
 */
export interface DeviceApduSender<Dependencies> {
  sendApdu: SendApduFnType;
  getDependencies: () => Dependencies;
  setDependencies: (dependencies: Dependencies) => void;
  closeConnection: () => void;
  setupConnection: () => Promise<void>;
}

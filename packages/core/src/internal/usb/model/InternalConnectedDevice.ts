import {
  DeviceId,
  DeviceModel,
} from "@internal/device-model/model/DeviceModel";
import { ConnectionType } from "@internal/discovery/model/ConnectionType";
import { SendApduFnType } from "@internal/usb/transport/DeviceConnection";

/**
 * Represents an internal connected device.
 */
export type ConnectedDeviceConstructorArgs = {
  id: DeviceId;
  deviceModel: DeviceModel;
  type: ConnectionType;
  sendApdu: SendApduFnType;
};

export class InternalConnectedDevice {
  public readonly id: DeviceId;
  public readonly deviceModel: DeviceModel;
  public readonly sendApdu: SendApduFnType;
  public readonly type: ConnectionType;

  constructor({
    id,
    deviceModel,
    sendApdu,
    type,
  }: ConnectedDeviceConstructorArgs) {
    this.id = id;
    this.deviceModel = deviceModel;
    this.sendApdu = sendApdu;
    this.type = type;
  }
}

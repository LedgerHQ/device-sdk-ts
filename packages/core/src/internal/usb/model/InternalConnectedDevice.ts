import { DeviceId } from "@api/device/DeviceModel";
import { ConnectionType } from "@api/discovery/ConnectionType";
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
import { SendApduFnType } from "@internal/usb/transport/DeviceConnection";

/**
 * Represents an internal connected device.
 */
export type ConnectedDeviceConstructorArgs = {
  id: DeviceId;
  deviceModel: InternalDeviceModel;
  type: ConnectionType;
  sendApdu: SendApduFnType;
};

export class InternalConnectedDevice {
  public readonly id: DeviceId;
  public readonly deviceModel: InternalDeviceModel;
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

import { DeviceId } from "@api/device/DeviceModel";
import { ConnectionType } from "@api/discovery/ConnectionType";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
import { SendApduFnType } from "@internal/transport/model/DeviceConnection";

/**
 * The internal connected device.
 */
export type ConnectedDeviceConstructorArgs = {
  id: DeviceId;
  deviceModel: InternalDeviceModel;
  type: ConnectionType;
  transport: TransportIdentifier;
  sendApdu: SendApduFnType;
};

export class InternalConnectedDevice {
  public readonly id: DeviceId;
  public readonly deviceModel: InternalDeviceModel;
  public readonly sendApdu: SendApduFnType;
  public readonly type: ConnectionType;
  public readonly transport: TransportIdentifier;

  constructor({
    id,
    deviceModel,
    type,
    transport,
    sendApdu,
  }: ConnectedDeviceConstructorArgs) {
    this.id = id;
    this.deviceModel = deviceModel;
    this.sendApdu = sendApdu;
    this.type = type;
    this.transport = transport;
  }
}

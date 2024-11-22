import { type DeviceId } from "@api/device/DeviceModel";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { type SendApduFnType } from "@api/transport/model/DeviceConnection";
import { type TransportIdentifier } from "@api/transport/model/TransportIdentifier";

/**
 * The internal connected device.
 */
export type ConnectedDeviceConstructorArgs = {
  id: DeviceId;
  deviceModel: TransportDeviceModel;
  type: ConnectionType;
  transport: TransportIdentifier;
  sendApdu: SendApduFnType;
};

export class TransportConnectedDevice {
  public readonly id: DeviceId;
  public readonly deviceModel: TransportDeviceModel;
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

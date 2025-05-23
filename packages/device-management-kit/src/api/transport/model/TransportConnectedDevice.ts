import { type DeviceId } from "@api/device/DeviceModel";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { ExchangeBulkApdusFnType, type SendApduFnType } from "@api/transport/model/DeviceConnection";
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
  exchangeBulkApdus?: ExchangeBulkApdusFnType;
};

export class TransportConnectedDevice {
  public readonly id: DeviceId;
  public readonly deviceModel: TransportDeviceModel;
  public readonly sendApdu: SendApduFnType;
  public readonly exchangeBulkApdus?: ExchangeBulkApdusFnType;
  public readonly type: ConnectionType;
  public readonly transport: TransportIdentifier;

  constructor({
    id,
    deviceModel,
    type,
    transport,
    sendApdu,
    exchangeBulkApdus,
  }: ConnectedDeviceConstructorArgs) {
    this.id = id;
    this.deviceModel = deviceModel;
    this.sendApdu = sendApdu;
    this.type = type;
    this.transport = transport;
    this.exchangeBulkApdus = exchangeBulkApdus;
  }
}

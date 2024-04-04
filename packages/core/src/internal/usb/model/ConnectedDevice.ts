import {
  DeviceId,
  DeviceModel,
} from "@internal/device-model/model/DeviceModel";
import type { SendApduFnType } from "@internal/usb/transport/DeviceConnection";

export type ConnectionType = "USB" | "BLE" | "MOCK";

/**
 * Represents a connected device.
 */
export type ConnectedDeviceConstructorArgs = {
  id: DeviceId;
  deviceModel: DeviceModel;
  type: ConnectionType;
  sendApdu: SendApduFnType;
};

export class ConnectedDevice {
  private readonly _id: DeviceId;
  private readonly _deviceModel: DeviceModel;
  private readonly _sendApdu: SendApduFnType;
  private readonly _type: ConnectionType;

  constructor({
    id,
    deviceModel,
    sendApdu,
    type,
  }: ConnectedDeviceConstructorArgs) {
    this._id = id;
    this._deviceModel = deviceModel;
    this._sendApdu = sendApdu;
    this._type = type;
  }

  public get id() {
    return this._id;
  }

  public get deviceModel() {
    return this._deviceModel;
  }

  public get deviceName() {
    return this._deviceModel.productName;
  }

  public get type() {
    return this._type;
  }

  public get sendApdu() {
    return this._sendApdu;
  }
}

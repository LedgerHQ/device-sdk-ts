import {
  DeviceId,
  DeviceModelId,
} from "@internal/device-model/model/DeviceModel";
import { ConnectionType } from "@internal/discovery/model/ConnectionType";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

type ConnectedDeviceConstructorArgs = {
  internalConnectedDevice: InternalConnectedDevice;
};

export class ConnectedDevice {
  public readonly id: DeviceId;
  public readonly modelId: DeviceModelId;
  public readonly name: string;
  public readonly type: ConnectionType;

  constructor({
    internalConnectedDevice: {
      id,
      deviceModel: { id: deviceModelId, productName: deviceName },
      type,
    },
  }: ConnectedDeviceConstructorArgs) {
    this.id = id;
    this.modelId = deviceModelId;
    this.name = deviceName;
    this.type = type;
  }
}

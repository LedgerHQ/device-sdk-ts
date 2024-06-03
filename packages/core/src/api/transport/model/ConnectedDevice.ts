import { DeviceId, DeviceModelId } from "@api/device/DeviceModel";
import { ConnectionType } from "@api/discovery/ConnectionType";
import { InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";

type ConnectedDeviceConstructorArgs = {
  readonly internalConnectedDevice: InternalConnectedDevice;
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

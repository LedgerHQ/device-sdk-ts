import { type DeviceId, type DeviceModelId } from "@api/device/DeviceModel";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { type TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";

type ConnectedDeviceConstructorArgs = {
  readonly transportConnectedDevice: TransportConnectedDevice;
};

export class ConnectedDevice {
  public readonly id: DeviceId;
  public readonly modelId: DeviceModelId;
  public readonly name: string;
  public readonly type: ConnectionType;

  constructor({
    transportConnectedDevice: {
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

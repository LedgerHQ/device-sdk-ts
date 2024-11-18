import { type DeviceId, type DeviceModelId } from "@api/device/DeviceModel";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { type DeviceSessionId } from "@api/types";
import { type InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";

type ConnectedDeviceConstructorArgs = {
  readonly internalConnectedDevice: InternalConnectedDevice;
  readonly sessionId: DeviceSessionId;
};

export class ConnectedDevice {
  public readonly id: DeviceId;
  public readonly sessionId: DeviceSessionId;
  public readonly modelId: DeviceModelId;
  public readonly name: string;
  public readonly type: ConnectionType;

  constructor({
    internalConnectedDevice: {
      id,
      deviceModel: { id: deviceModelId, productName: deviceName },
      type,
    },
    sessionId,
  }: ConnectedDeviceConstructorArgs) {
    this.id = id;
    this.sessionId = sessionId;
    this.modelId = deviceModelId;
    this.name = deviceName;
    this.type = type;
  }
}

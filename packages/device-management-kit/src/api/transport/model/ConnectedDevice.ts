import { type DeviceId, type DeviceModelId } from "@api/device/DeviceModel";
import { type ConnectionType } from "@api/discovery/ConnectionType";
import { type TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";
import { type DeviceSessionId } from "@api/types";

type ConnectedDeviceConstructorArgs = {
  readonly sessionId: DeviceSessionId;
  readonly transportConnectedDevice: TransportConnectedDevice;
};

export class ConnectedDevice {
  public readonly id: DeviceId;
  public readonly sessionId: DeviceSessionId;
  public readonly modelId: DeviceModelId;
  public readonly name: string;
  public readonly type: ConnectionType;

  constructor({
    transportConnectedDevice: {
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

import { v4 as uuidv4 } from "uuid";

import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

export type SessionId = ReturnType<typeof uuidv4>;

export type SessionConstructorArgs = {
  connectedDevice: InternalConnectedDevice;
  id?: SessionId;
};

/**
 * Represents a session with a device.
 */
export class Session {
  private readonly _id: SessionId;
  private readonly _connectedDevice: InternalConnectedDevice;

  constructor({ connectedDevice, id = uuidv4() }: SessionConstructorArgs) {
    this._id = id;
    this._connectedDevice = connectedDevice;
  }

  public get id() {
    return this._id;
  }

  public get connectedDevice() {
    return this._connectedDevice;
  }

  sendApdu(_args: Uint8Array) {
    return this._connectedDevice.sendApdu(_args);
  }
}

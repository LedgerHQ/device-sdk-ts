import { v4 as uuidv4 } from "uuid";

import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";

export type SessionId = ReturnType<typeof uuidv4>;

/**
 * Represents a session with a device.
 */
export class Session {
  private readonly _id: SessionId;
  private readonly _connectedDevice: ConnectedDevice;

  constructor({ connectedDevice }: { connectedDevice: ConnectedDevice }) {
    this._id = uuidv4();
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

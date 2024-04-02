import { EitherAsync } from "purify-ts";
import { v4 as uuidv4 } from "uuid";

import { SdkError } from "@api/Error";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";
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

  public get id(): SessionId {
    return this._id;
  }

  public get connectedDevice(): ConnectedDevice {
    return this._connectedDevice;
  }

  sendApdu(_args: Uint8Array): EitherAsync<SdkError, ApduResponse> {
    return this._connectedDevice.sendApdu(_args);
  }
}

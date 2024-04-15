import { v4 as uuidv4 } from "uuid";

import { Command } from "@api/command/Command";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

export type SessionId = string;

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

  executeCommand<Params, T>(
    _params: Params,
    _command: Command<Params, T>,
  ): Promise<T> {
    // const apdu = command.getApdu(params);
    // do some magic with apdu
    // const response = command.parseResponse();
    // return response;
    throw new Error("Method not implemented.");
  }
}

import { v4 as uuidv4 } from "uuid";

import { Command } from "@api/command/Command";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

export type SessionId = string;

export type ExecuteCommandFn<Params, T> = (
  command: Command<Params, T>,
) => (params?: Params) => Promise<T>;

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

  sendApdu(apdu: Uint8Array) {
    return this._connectedDevice.sendApdu(apdu);
  }

  getCommand<Params, T>(command: Command<Params, T>) {
    return async (params?: Params): Promise<T> => {
      const apdu = command.getApdu(params);
      const response = await this.sendApdu(apdu.getRawApdu());

      return response.caseOf({
        Left: (err) => {
          throw err;
        },
        Right: (r) => command.parseResponse(r),
      });
    };
  }
}

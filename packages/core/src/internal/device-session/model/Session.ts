import { BehaviorSubject } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { Command } from "@api/command/Command";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { DeviceModelId } from "@api/device/DeviceModel";
import { SessionDeviceState } from "@api/session/SessionDeviceState";
import { SessionId } from "@api/session/types";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";
import { DeviceStatus } from "@root/src";

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
  private readonly _deviceState: BehaviorSubject<SessionDeviceState>;

  constructor({ connectedDevice, id = uuidv4() }: SessionConstructorArgs) {
    this._id = id;
    this._connectedDevice = connectedDevice;
    this._deviceState = new BehaviorSubject<SessionDeviceState>(
      new SessionDeviceState({
        sessionId: this._id,
        deviceStatus: DeviceStatus.CONNECTED,
      }),
    );
  }

  public get id() {
    return this._id;
  }

  public get connectedDevice() {
    return this._connectedDevice;
  }

  public get state() {
    return this._deviceState.asObservable();
  }

  private updateDeviceStatus(deviceStatus: DeviceStatus) {
    const sessionState = this._deviceState.getValue();
    this._deviceState.next(
      new SessionDeviceState({
        ...sessionState,
        deviceStatus,
      }),
    );
  }

  async sendApdu(rawApdu: Uint8Array) {
    this.updateDeviceStatus(DeviceStatus.BUSY);

    const errorOrResponse = await this._connectedDevice.sendApdu(rawApdu);

    return errorOrResponse.map((response) => {
      this.updateDeviceStatus(
        CommandUtils.isLockedDeviceResponse(response)
          ? DeviceStatus.LOCKED
          : DeviceStatus.CONNECTED,
      );
      return response;
    });
  }

  getCommand<T, U>(command: Command<T, U>) {
    return async (deviceModelId: DeviceModelId, getApduArgs: U): Promise<T> => {
      const apdu = command.getApdu(getApduArgs);
      const response = await this.sendApdu(apdu.getRawApdu());

      return response.caseOf({
        Left: (err) => {
          throw err;
        },
        Right: (r) => command.parseResponse(r, deviceModelId),
      });
    };
  }

  close() {
    this._deviceState.complete();
  }
}

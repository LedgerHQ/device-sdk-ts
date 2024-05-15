import { BehaviorSubject } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { Command } from "@api/command/Command";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { DeviceSessionId } from "@api/device-session/types";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

export type SessionConstructorArgs = {
  connectedDevice: InternalConnectedDevice;
  id?: DeviceSessionId;
};

/**
 * Represents a session with a device.
 */
export class DeviceSession {
  private readonly _id: DeviceSessionId;
  private readonly _connectedDevice: InternalConnectedDevice;
  private readonly _deviceState: BehaviorSubject<DeviceSessionState>;

  constructor({ connectedDevice, id = uuidv4() }: SessionConstructorArgs) {
    this._id = id;
    this._connectedDevice = connectedDevice;
    this._deviceState = new BehaviorSubject<DeviceSessionState>(
      new DeviceSessionState({
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
      new DeviceSessionState({
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

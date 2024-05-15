import { Apdu } from "@api/apdu/model/Apdu";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";

export interface Command<T, U = void> {
  getApdu(args?: U): Apdu;
  parseResponse(
    apduResponse: ApduResponse,
    deviceModelId: DeviceModelId | void,
  ): T;
}

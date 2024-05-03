import { Apdu } from "@api/apdu/model/Apdu";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export interface Command<T, U = void> {
  getApdu(args?: U): Apdu;
  parseResponse(
    apduResponse: ApduResponse,
    deviceModelId: DeviceModelId | void,
  ): T;
}

import { Apdu } from "@api/apdu/model/Apdu";
import { DeviceModelId } from "@internal/device-model/model/DeviceModel";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export interface Command<Params, T> {
  getApdu(params?: Params): Apdu;
  parseResponse(responseApdu: ApduResponse, deviceModelId: DeviceModelId): T;
}

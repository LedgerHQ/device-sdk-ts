import { Apdu } from "@api/apdu/model/Apdu";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export interface Command<Params, T> {
  getApdu(params?: Params): Apdu;
  parseResponse(responseApdu: ApduResponse): T;
}

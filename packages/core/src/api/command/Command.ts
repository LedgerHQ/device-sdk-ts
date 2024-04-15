import { Apdu } from "@api/apdu/model/Apdu";

export interface Command<Params, T> {
  getApdu(params?: Params): Apdu;
  parseResponse(responseApdu: Apdu): T;
}

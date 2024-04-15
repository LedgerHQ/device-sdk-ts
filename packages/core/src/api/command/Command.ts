import { Apdu } from "@api/apdu/model/Apdu";

export interface Command<Params, T> {
  getApdu(params: Params): Apdu;
  parsesResponse(responseApdu: Apdu): T;
  execute(params: Params): Promise<T>;
}

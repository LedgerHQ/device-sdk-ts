import { Response } from "./model/Response";

export interface Transport {
  send(apduHex: String): Response | undefined;
}

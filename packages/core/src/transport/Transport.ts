import { Response } from "./model";

export interface Transport {
  send(apduHex: string): Response | undefined;
}

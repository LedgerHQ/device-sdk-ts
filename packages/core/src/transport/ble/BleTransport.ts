import { Response } from "../model";
import { Transport } from "../Transport";

export class BleTransport implements Transport {
  send(_apduHex: string): Response | undefined {
    return undefined;
  }
}

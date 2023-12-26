import { Transport } from "../Transport";
import { Response } from "../model";

export class BleTransport implements Transport {
  send(_apduHex: string): Response | undefined {
    return undefined;
  }
}

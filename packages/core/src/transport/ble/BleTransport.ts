import { Response } from "@transport/model";
import { Transport } from "@transport/Transport";

export class BleTransport implements Transport {
  send(_apduHex: string): Response | undefined {
    return undefined;
  }
}

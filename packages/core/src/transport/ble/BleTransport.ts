import { Response } from "@root/src/transport/model";
import { Transport } from "@root/src/transport/Transport";

export class BleTransport implements Transport {
  send(_apduHex: string): Response | undefined {
    return undefined;
  }
}

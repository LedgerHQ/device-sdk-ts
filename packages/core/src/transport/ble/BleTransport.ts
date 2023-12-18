import { Transport } from "../Transport";
import { Response } from "../model/Response";

export class BleTransport implements Transport {
  send(_apduHex: String): Response | undefined {
    return undefined;
  }
}

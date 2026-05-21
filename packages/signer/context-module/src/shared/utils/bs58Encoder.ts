import bs58 from "bs58";

export interface Bs58Encoder {
  encode(data: Uint8Array): string;
  decode(encoded: string): Uint8Array;
}

export class DefaultBs58Encoder {
  static encode(data: Uint8Array): string {
    return bs58.encode(data);
  }
  static decode(encoded: string): Uint8Array {
    return bs58.decode(encoded);
  }
}

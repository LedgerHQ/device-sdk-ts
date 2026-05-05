import { AbiCoder } from "ethers";
import { injectable } from "inversify";

import { type AbiDecoderDataSource } from "./AbiDecoderDataSource";

@injectable()
export class EthersAbiDecoderDataSource implements AbiDecoderDataSource {
  decode(types: string[], data: string): unknown[] {
    try {
      return AbiCoder.defaultAbiCoder().decode(types, data);
    } catch (_) {
      return [];
    }
  }
}

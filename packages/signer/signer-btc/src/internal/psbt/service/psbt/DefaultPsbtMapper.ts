import {
  base64StringToBuffer,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Psbt as BitcoinJsPsbt } from "bitcoinjs-lib";
import { inject, injectable } from "inversify";
import { Either, Left } from "purify-ts";

import type { Psbt } from "@api/model/Psbt";
import { psbtTypes } from "@internal/psbt/di/psbtTypes";
import { Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";

import { PsbtMapper } from "./PsbtMapper";
import type { PsbtSerializer } from "./PsbtSerializer";
import type { PsbtV2Normalizer } from "./PsbtV2Normalizer";

/**
 * Map any PSBT format from the API to a parsed and normalized internal PSBT
 */
@injectable()
export class DefaultPsbtMapper implements PsbtMapper {
  constructor(
    @inject(psbtTypes.PsbtSerializer)
    private psbtSerializer: PsbtSerializer,
    @inject(psbtTypes.PsbtV2Normalizer)
    private psbtV2Normalizer: PsbtV2Normalizer,
  ) {}

  map(psbt: Psbt): Either<Error, InternalPsbt> {
    // Try to map from bitcoinjs
    if (psbt instanceof BitcoinJsPsbt) {
      psbt = psbt.toHex();
    }

    // Try to map from base64 or hexa strings
    if (typeof psbt === "string") {
      let buffer = hexaStringToBuffer(psbt);
      if (buffer !== null) {
        psbt = buffer;
      } else {
        buffer = base64StringToBuffer(psbt);
        if (buffer !== null) {
          psbt = buffer;
        } else {
          return Left(new Error("PSBT mapper: format not supported"));
        }
      }
    }

    return this.psbtSerializer
      .deserialize(psbt)
      .chain((internalPsbt) => this.psbtV2Normalizer.normalize(internalPsbt));
  }
}

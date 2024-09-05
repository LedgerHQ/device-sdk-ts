import { Either } from "purify-ts";

import { Psbt } from "@internal/psbt/model/Psbt";

export interface PsbtV2Normalizer {
  normalize(psbt: Psbt): Either<Error, Psbt>;
}

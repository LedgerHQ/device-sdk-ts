import { type Either } from "purify-ts";

import { type Psbt } from "@internal/psbt/model/Psbt";

export interface PsbtV2Normalizer {
  normalize(psbt: Psbt): Either<Error, Psbt>;
}

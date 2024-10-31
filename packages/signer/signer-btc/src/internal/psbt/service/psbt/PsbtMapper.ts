import { type Either } from "purify-ts";

import type { Psbt } from "@api/model/Psbt";
import { type Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";

export interface PsbtMapper {
  map(psbt: Psbt): Either<Error, InternalPsbt>;
}

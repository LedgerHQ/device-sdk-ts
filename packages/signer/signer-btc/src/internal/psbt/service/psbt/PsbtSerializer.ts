import { type Either } from "purify-ts";

import { type Psbt } from "@internal/psbt/model/Psbt";

export interface PsbtSerializer {
  deserialize(buffer: Uint8Array): Either<Error, Psbt>;
  serialize(psbt: Psbt): Uint8Array;
}

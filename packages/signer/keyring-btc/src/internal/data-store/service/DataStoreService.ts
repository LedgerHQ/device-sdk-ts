import { Either } from "purify-ts";

import type { DataStore } from "@internal/data-store/model/DataStore";
import { Psbt } from "@internal/psbt/model/Psbt";

export type PsbtCommitment = {
  globalCommitment: Uint8Array;
  inputsRoot: Uint8Array;
  outputsRoot: Uint8Array;
};

export interface DataStoreService {
  merklizeChunks(store: DataStore, chunks: Uint8Array[]): Uint8Array;
  merklizePsbt(store: DataStore, psbt: Psbt): Either<Error, PsbtCommitment>;
}

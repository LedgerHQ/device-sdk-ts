import { Maybe } from "purify-ts";

import { type MerkleMap } from "@internal/merkle-tree/model/MerkleMap";

export interface MerkleMapService {
  create(keys: Uint8Array[], values: Uint8Array[]): Maybe<MerkleMap>;
}

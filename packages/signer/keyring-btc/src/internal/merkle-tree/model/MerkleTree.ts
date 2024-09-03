import { Maybe } from "purify-ts";

import { Leaf } from "@internal/merkle-tree/model/Node";

export interface MerkleTree {
  size(): number;
  getRoot(): Uint8Array;
  getLeaves(): Leaf[];
  getLeafHash(index: number): Maybe<Uint8Array>;
  getProof(index: number): Maybe<Uint8Array[]>;
}

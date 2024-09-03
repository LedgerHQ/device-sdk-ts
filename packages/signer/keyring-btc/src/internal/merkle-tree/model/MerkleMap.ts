import { MerkleTree } from "./MerkleTree";

export interface MerkleMap {
  getKeys(): MerkleTree;
  getValues(): MerkleTree;
  getCommitment(): Uint8Array;
}

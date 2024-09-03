import { type MerkleTree } from "@internal/merkle-tree/model/MerkleTree";

export interface MerkleTreeService {
  create(leaves: Uint8Array[]): MerkleTree;
}

import { injectable } from "inversify";

import { DefaultMerkleTree } from "@internal/merkle-tree/model/DefaultMerkleTree";
import { Sha256Hasher } from "@internal/merkle-tree/model/Hasher";
import { type MerkleTree } from "@internal/merkle-tree/model/MerkleTree";

import { type MerkleTreeService } from "./MerkleTreeService";

@injectable()
export class DefaultMerkleTreeService implements MerkleTreeService {
  create(leaves: Uint8Array[]): MerkleTree {
    return new DefaultMerkleTree(leaves, Sha256Hasher);
  }
}

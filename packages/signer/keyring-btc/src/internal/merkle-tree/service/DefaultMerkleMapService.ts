import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import { DefaultMerkleMap } from "@internal/merkle-tree/model/DefaultMerkleMap";
import { type MerkleMap } from "@internal/merkle-tree/model/MerkleMap";

import { type MerkleMapService } from "./MerkleMapService";
import { type MerkleTreeService } from "./MerkleTreeService";

@injectable()
export class DefaultMerkleMapService implements MerkleMapService {
  constructor(
    @inject(merkleTreeTypes.MerkleTreeService)
    private merkleTreeService: MerkleTreeService,
  ) {}

  create(keys: Uint8Array[], values: Uint8Array[]): Maybe<MerkleMap> {
    return DefaultMerkleMap.create(keys, values, this.merkleTreeService);
  }
}

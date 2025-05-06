import { ContainerModule } from "inversify";

import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";

export const merkleTreeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(merkleTreeTypes.HasherService).to(Sha256HasherService);
    bind(merkleTreeTypes.MerkleTreeBuilder).to(MerkleTreeBuilder);
    bind(merkleTreeTypes.MerkleMapBuilder).to(MerkleMapBuilder);
  });

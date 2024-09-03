import { ContainerModule } from "inversify";

import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import { DefaultMerkleMapService } from "@internal/merkle-tree/service/DefaultMerkleMapService";
import { DefaultMerkleTreeService } from "@internal/merkle-tree/service/DefaultMerkleTreeService";

export const merkleTreeModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(merkleTreeTypes.MerkleTreeService).to(DefaultMerkleTreeService);
      bind(merkleTreeTypes.MerkleMapService).to(DefaultMerkleMapService);
    },
  );

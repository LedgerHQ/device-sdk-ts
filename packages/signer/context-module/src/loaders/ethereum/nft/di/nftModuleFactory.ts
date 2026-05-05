import { ContainerModule } from "inversify";

import { HttpNftDataSource } from "@/loaders/ethereum/nft/data/HttpNftDataSource";
import { ethereumNftTypes } from "@/loaders/ethereum/nft/di/ethereumNftTypes";
import { NftContextFieldLoader } from "@/loaders/ethereum/nft/domain/NftContextFieldLoader";
import { NftContextLoader } from "@/loaders/ethereum/nft/domain/NftContextLoader";

export const nftModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumNftTypes.EthereumNftDataSource).to(HttpNftDataSource);
    bind(ethereumNftTypes.EthereumNftContextLoader).to(NftContextLoader);
    bind(ethereumNftTypes.EthereumNftContextFieldLoader).to(
      NftContextFieldLoader,
    );
  });

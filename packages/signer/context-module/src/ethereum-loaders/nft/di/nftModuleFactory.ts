import { ContainerModule } from "inversify";

import { HttpNftDataSource } from "@/ethereum-loaders/nft/data/HttpNftDataSource";
import { ethereumNftTypes } from "@/ethereum-loaders/nft/di/ethereumNftTypes";
import { NftContextFieldLoader } from "@/ethereum-loaders/nft/domain/NftContextFieldLoader";
import { NftContextLoader } from "@/ethereum-loaders/nft/domain/NftContextLoader";

export const nftModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumNftTypes.EthereumNftDataSource).to(HttpNftDataSource);
    bind(ethereumNftTypes.EthereumNftContextLoader).to(NftContextLoader);
    bind(ethereumNftTypes.EthereumNftContextFieldLoader).to(
      NftContextFieldLoader,
    );
  });

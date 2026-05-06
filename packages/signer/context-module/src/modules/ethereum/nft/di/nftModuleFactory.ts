import { ContainerModule } from "inversify";

import { HttpNftDataSource } from "@/modules/ethereum/nft/data/HttpNftDataSource";
import { ethereumNftTypes } from "@/modules/ethereum/nft/di/ethereumNftTypes";
import { NftContextFieldLoader } from "@/modules/ethereum/nft/domain/NftContextFieldLoader";
import { NftContextLoader } from "@/modules/ethereum/nft/domain/NftContextLoader";

export const nftModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumNftTypes.EthereumNftDataSource).to(HttpNftDataSource);
    bind(ethereumNftTypes.EthereumNftContextLoader).to(NftContextLoader);
    bind(ethereumNftTypes.EthereumNftContextFieldLoader).to(
      NftContextFieldLoader,
    );
  });

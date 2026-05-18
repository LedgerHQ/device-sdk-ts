import { ContainerModule } from "inversify";

import { HttpNftDataSource } from "@/modules/ethereum/nft/data/HttpNftDataSource";
import { nftTypes } from "@/modules/ethereum/nft/di/nftTypes";
import { NftContextFieldLoader } from "@/modules/ethereum/nft/domain/NftContextFieldLoader";
import { NftContextLoader } from "@/modules/ethereum/nft/domain/NftContextLoader";

export const nftModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(nftTypes.NftDataSource).to(HttpNftDataSource);
    bind(nftTypes.NftContextLoader).to(NftContextLoader);
    bind(nftTypes.NftContextFieldLoader).to(NftContextFieldLoader);
  });

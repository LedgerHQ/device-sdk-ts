import { ContainerModule } from "inversify";

import { HttpNftDataSource } from "@/nft/data/HttpNftDataSource";
import { nftTypes } from "@/nft/di/nftTypes";
import { NftContextFieldLoader } from "@/nft/domain/NftContextFieldLoader";
import { NftContextLoader } from "@/nft/domain/NftContextLoader";

export const nftModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(nftTypes.NftDataSource).to(HttpNftDataSource);
    bind(nftTypes.NftContextLoader).to(NftContextLoader);
    bind(nftTypes.NftContextFieldLoader).to(NftContextFieldLoader);
  });

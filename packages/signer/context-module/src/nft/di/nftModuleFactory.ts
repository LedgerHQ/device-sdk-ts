import { ContainerModule } from "inversify";

import { HttpNftDataSource } from "@/nft/data/HttpNftDataSource";
import { nftTypes } from "@/nft/di/nftTypes";

export const nftModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(nftTypes.NftDataSource).to(HttpNftDataSource);
  });

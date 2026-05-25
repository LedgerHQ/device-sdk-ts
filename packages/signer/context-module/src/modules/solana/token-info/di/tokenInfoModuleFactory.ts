import { ContainerModule } from "inversify";

import { HttpTokenInfoDataSource } from "@/modules/solana/token-info/data/HttpTokenInfoDataSource";
import { tokenInfoTypes } from "@/modules/solana/token-info/di/tokenInfoTypes";
import { TokenInfoContextLoader } from "@/modules/solana/token-info/domain/TokenInfoContextLoader";

export const tokenInfoModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tokenInfoTypes.TokenInfoDataSource).to(HttpTokenInfoDataSource);
    bind(tokenInfoTypes.TokenInfoContextLoader).to(TokenInfoContextLoader);
  });

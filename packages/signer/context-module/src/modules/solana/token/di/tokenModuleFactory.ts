import { ContainerModule } from "inversify";

import { HttpTokenDataSource } from "@/modules/solana/token/data/HttpTokenDataSource";
import { tokenTypes } from "@/modules/solana/token/di/tokenTypes";
import { TokenContextLoader } from "@/modules/solana/token/domain/TokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tokenTypes.TokenDataSource).to(HttpTokenDataSource);
    bind(tokenTypes.TokenContextLoader).to(TokenContextLoader);
  });

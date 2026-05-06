import { ContainerModule } from "inversify";

import { HttpTokenDataSource } from "@/modules/ethereum/token/data/HttpTokenDataSource";
import { tokenTypes } from "@/modules/ethereum/token/di/tokenTypes";
import { TokenContextFieldLoader } from "@/modules/ethereum/token/domain/TokenContextFieldLoader";
import { TokenContextLoader } from "@/modules/ethereum/token/domain/TokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tokenTypes.TokenDataSource).to(HttpTokenDataSource);
    bind(tokenTypes.TokenContextLoader).to(TokenContextLoader);
    bind(tokenTypes.TokenContextFieldLoader).to(TokenContextFieldLoader);
  });

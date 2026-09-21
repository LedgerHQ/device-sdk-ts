import { ContainerModule } from "inversify";

import { HttpTokenDataSource } from "@/modules/tron/token/data/HttpTokenDataSource";
import { tokenTypes } from "@/modules/tron/token/di/tokenTypes";
import { TokenContextLoader } from "@/modules/tron/token/domain/TokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tokenTypes.TokenDataSource).to(HttpTokenDataSource);
    bind(tokenTypes.TokenContextLoader).to(TokenContextLoader);
  });

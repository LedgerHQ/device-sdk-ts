import { ContainerModule } from "inversify";

import { HttpTokenDataSource } from "@/modules/ethereum/token/data/HttpTokenDataSource";
import { ethereumTokenTypes } from "@/modules/ethereum/token/di/ethereumTokenTypes";
import { TokenContextFieldLoader } from "@/modules/ethereum/token/domain/TokenContextFieldLoader";
import { TokenContextLoader } from "@/modules/ethereum/token/domain/TokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumTokenTypes.EthereumTokenDataSource).to(HttpTokenDataSource);
    bind(ethereumTokenTypes.EthereumTokenContextLoader).to(TokenContextLoader);
    bind(ethereumTokenTypes.EthereumTokenContextFieldLoader).to(
      TokenContextFieldLoader,
    );
  });

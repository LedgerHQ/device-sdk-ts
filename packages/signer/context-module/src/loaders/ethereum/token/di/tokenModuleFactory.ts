import { ContainerModule } from "inversify";

import { HttpTokenDataSource } from "@/loaders/ethereum/token/data/HttpTokenDataSource";
import { ethereumTokenTypes } from "@/loaders/ethereum/token/di/ethereumTokenTypes";
import { TokenContextFieldLoader } from "@/loaders/ethereum/token/domain/TokenContextFieldLoader";
import { TokenContextLoader } from "@/loaders/ethereum/token/domain/TokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumTokenTypes.EthereumTokenDataSource).to(HttpTokenDataSource);
    bind(ethereumTokenTypes.EthereumTokenContextLoader).to(TokenContextLoader);
    bind(ethereumTokenTypes.EthereumTokenContextFieldLoader).to(
      TokenContextFieldLoader,
    );
  });

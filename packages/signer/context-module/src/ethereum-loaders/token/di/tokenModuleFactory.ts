import { ContainerModule } from "inversify";

import { HttpTokenDataSource } from "@/ethereum-loaders/token/data/HttpTokenDataSource";
import { ethereumTokenTypes } from "@/ethereum-loaders/token/di/ethereumTokenTypes";
import { TokenContextFieldLoader } from "@/ethereum-loaders/token/domain/TokenContextFieldLoader";
import { TokenContextLoader } from "@/ethereum-loaders/token/domain/TokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumTokenTypes.EthereumTokenDataSource).to(HttpTokenDataSource);
    bind(ethereumTokenTypes.EthereumTokenContextLoader).to(TokenContextLoader);
    bind(ethereumTokenTypes.EthereumTokenContextFieldLoader).to(
      TokenContextFieldLoader,
    );
  });

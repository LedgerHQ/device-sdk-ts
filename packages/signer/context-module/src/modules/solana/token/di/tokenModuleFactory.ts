import { ContainerModule } from "inversify";

import { HttpTokenDataSource } from "@/modules/solana/token/data/HttpTokenDataSource";
import { solanaTokenTypes } from "@/modules/solana/token/di/solanaTokenTypes";
import { TokenContextLoader } from "@/modules/solana/token/domain/TokenContextLoader";

export const tokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaTokenTypes.SolanaTokenDataSource).to(HttpTokenDataSource);
    bind(solanaTokenTypes.SolanaTokenContextLoader).to(TokenContextLoader);
  });

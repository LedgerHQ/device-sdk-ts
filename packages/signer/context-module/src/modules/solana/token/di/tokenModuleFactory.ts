import { ContainerModule } from "inversify";

import { HttpSolanaTokenDataSource } from "@/modules/solana/token/data/HttpSolanaTokenDataSource";
import { solanaTokenTypes } from "@/modules/solana/token/di/solanaTokenTypes";
import { SolanaTokenContextLoader } from "@/modules/solana/token/domain/SolanaTokenContextLoader";

export const solanaTokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaTokenTypes.SolanaTokenDataSource).to(HttpSolanaTokenDataSource);
    bind(solanaTokenTypes.SolanaTokenContextLoader).to(
      SolanaTokenContextLoader,
    );
  });

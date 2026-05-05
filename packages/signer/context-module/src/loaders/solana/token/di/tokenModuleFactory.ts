import { ContainerModule } from "inversify";

import { HttpSolanaTokenDataSource } from "@/loaders/solana/token/data/HttpSolanaTokenDataSource";
import { solanaTokenTypes } from "@/loaders/solana/token/di/solanaTokenTypes";
import { SolanaTokenContextLoader } from "@/loaders/solana/token/domain/SolanaTokenContextLoader";

export const solanaTokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaTokenTypes.SolanaTokenDataSource).to(HttpSolanaTokenDataSource);
    bind(solanaTokenTypes.SolanaTokenContextLoader).to(
      SolanaTokenContextLoader,
    );
  });

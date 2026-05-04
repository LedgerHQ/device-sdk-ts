import { ContainerModule } from "inversify";

import { HttpSolanaTokenDataSource } from "@/solana-loaders/token/data/HttpSolanaTokenDataSource";
import { solanaTokenTypes } from "@/solana-loaders/token/di/solanaTokenTypes";
import { SolanaTokenContextLoader } from "@/solana-loaders/token/domain/SolanaTokenContextLoader";

export const solanaTokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaTokenTypes.SolanaTokenDataSource).to(HttpSolanaTokenDataSource);
    bind(solanaTokenTypes.SolanaTokenContextLoader).to(
      SolanaTokenContextLoader,
    );
  });

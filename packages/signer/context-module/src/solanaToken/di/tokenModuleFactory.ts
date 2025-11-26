import { ContainerModule } from "inversify";

import { HttpSolanaTokenDataSource } from "@/solanaToken/data/HttpSolanaTokenDataSource";
import { solanaTokenTypes } from "@/solanaToken/di/solanaTokenTypes";
import { SolanaTokenContextLoader } from "@/solanaToken/domain/SolanaTokenContextLoader";

export const solanaTokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaTokenTypes.SolanaTokenDataSource).to(HttpSolanaTokenDataSource);
    bind(solanaTokenTypes.SolanaTokenContextLoader).to(
      SolanaTokenContextLoader,
    );
  });

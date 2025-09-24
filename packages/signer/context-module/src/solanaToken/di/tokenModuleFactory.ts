import { ContainerModule } from "inversify";

import { solanaTokenTypes } from "@/solanaToken/di/solanaTokenTypes";
import { SolanaTokenContextLoader } from "@/solanaToken/domain/SolanaTokenContextLoader";
import { HttpTokenDataSource } from "@/token/data/HttpTokenDataSource";

export const solanaTokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaTokenTypes.SolanaTokenDataSource).to(HttpTokenDataSource);
    bind(solanaTokenTypes.SolanaTokenContextLoader).to(
      SolanaTokenContextLoader,
    );
  });

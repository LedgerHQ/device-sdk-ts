import { ContainerModule } from "inversify";

import { HttpSolanaDataSource } from "@/solana/data/HttpSolanaDataSource";
import { solanaContextTypes } from "@/solana/di/solanaContextTypes";
import { DefaultSolanaContextLoader } from "@/solana/domain/DefaultSolanaContextLoader";

export const solanaContextModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaContextTypes.SolanaDataSource).to(HttpSolanaDataSource);
    bind(solanaContextTypes.SolanaContextLoader).to(DefaultSolanaContextLoader);
  });

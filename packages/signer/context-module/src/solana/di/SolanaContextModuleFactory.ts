import { ContainerModule } from "inversify";

import { HttpSolanaOwnerInfoDataSource } from "@/solana/data/HttpSolanaOwnerInfoDataSource";
import { solanaContextTypes } from "@/solana/di/solanaContextTypes";
import { DefaultSolanaContextLoader } from "@/solana/domain/DefaultSolanaContextLoader";

export const solanaContextModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaContextTypes.SolanaDataSource).to(HttpSolanaOwnerInfoDataSource);
    bind(solanaContextTypes.SolanaContextLoader).to(DefaultSolanaContextLoader);
  });

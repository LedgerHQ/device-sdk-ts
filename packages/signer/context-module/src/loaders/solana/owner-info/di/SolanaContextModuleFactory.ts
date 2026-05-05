import { ContainerModule } from "inversify";

import { HttpSolanaOwnerInfoDataSource } from "@/loaders/solana/owner-info/data/HttpSolanaOwnerInfoDataSource";
import { solanaContextTypes } from "@/loaders/solana/owner-info/di/solanaContextTypes";
import { SolanaOwnerInfoContextLoader } from "@/loaders/solana/owner-info/domain/SolanaOwnerInfoContextLoader";

export const solanaContextModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaContextTypes.SolanaDataSource).to(HttpSolanaOwnerInfoDataSource);
    bind(solanaContextTypes.SolanaOwnerInfoContextLoader).to(
      SolanaOwnerInfoContextLoader,
    );
  });

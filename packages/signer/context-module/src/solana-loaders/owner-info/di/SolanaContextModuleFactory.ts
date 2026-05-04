import { ContainerModule } from "inversify";

import { HttpSolanaOwnerInfoDataSource } from "@/solana-loaders/owner-info/data/HttpSolanaOwnerInfoDataSource";
import { solanaContextTypes } from "@/solana-loaders/owner-info/di/solanaContextTypes";
import { SolanaOwnerInfoContextLoader } from "@/solana-loaders/owner-info/domain/SolanaOwnerInfoContextLoader";

export const solanaContextModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaContextTypes.SolanaDataSource).to(HttpSolanaOwnerInfoDataSource);
    bind(solanaContextTypes.SolanaOwnerInfoContextLoader).to(
      SolanaOwnerInfoContextLoader,
    );
  });

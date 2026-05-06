import { ContainerModule } from "inversify";

import { HttpSolanaOwnerInfoDataSource } from "@/modules/solana/owner-info/data/HttpSolanaOwnerInfoDataSource";
import { solanaContextTypes } from "@/modules/solana/owner-info/di/solanaContextTypes";
import { SolanaOwnerInfoContextLoader } from "@/modules/solana/owner-info/domain/SolanaOwnerInfoContextLoader";

export const solanaContextModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaContextTypes.SolanaDataSource).to(HttpSolanaOwnerInfoDataSource);
    bind(solanaContextTypes.SolanaOwnerInfoContextLoader).to(
      SolanaOwnerInfoContextLoader,
    );
  });

import { ContainerModule } from "inversify";

import { HttpOwnerInfoDataSource } from "@/modules/solana/owner-info/data/HttpOwnerInfoDataSource";
import { solanaContextTypes } from "@/modules/solana/owner-info/di/solanaContextTypes";
import { OwnerInfoContextLoader } from "@/modules/solana/owner-info/domain/OwnerInfoContextLoader";

export const ownerInfoModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaContextTypes.SolanaDataSource).to(HttpOwnerInfoDataSource);
    bind(solanaContextTypes.SolanaOwnerInfoContextLoader).to(
      OwnerInfoContextLoader,
    );
  });

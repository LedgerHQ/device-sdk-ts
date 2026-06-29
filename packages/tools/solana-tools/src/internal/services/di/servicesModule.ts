import { ContainerModule } from "inversify";

import { type SolanaTransactionDataSource } from "@internal/data-source/SolanaTransactionDataSource";
import { Web3SolanaTransactionDataSource } from "@internal/data-source/Web3SolanaTransactionDataSource";
import { servicesTypes } from "@internal/services/di/servicesTypes";

export const servicesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind<SolanaTransactionDataSource>(
      servicesTypes.SolanaTransactionDataSource,
    ).to(Web3SolanaTransactionDataSource);
  });

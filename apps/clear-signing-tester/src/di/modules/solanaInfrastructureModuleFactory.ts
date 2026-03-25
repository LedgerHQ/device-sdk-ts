import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { ContainerModule } from "inversify";

import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { TYPES } from "@root/src/di/types";
import { type SolanaRpcAdapter } from "@root/src/domain/adapters/SolanaRpcAdapter";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type SolanaTransactionProgramRepository } from "@root/src/domain/repositories/SolanaTransactionProgramRepository";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { HttpSolanaRpcAdapter } from "@root/src/infrastructure/adapters/external/HttpSolanaRpcAdapter";
import { DefaultSolanaTransactionProgramRepository } from "@root/src/infrastructure/repositories/DefaultSolanaTransactionProgramRepository";
import { SolanaTransactionFileRepository } from "@root/src/infrastructure/repositories/SolanaTransactionFileRepository";
import { SolanaDMKServiceController } from "@root/src/infrastructure/service-controllers/SolanaDMKServiceController";
import { SolanaSigningService } from "@root/src/infrastructure/services/SolanaSigningService";
import { TransactionCraftingService } from "@root/src/infrastructure/services/TransactionCraftingService";

/**
 * Solana-specific infrastructure bindings.
 * Must be loaded together with {@link sharedInfrastructureModuleFactory}.
 */
export const solanaInfrastructureModuleFactory = (
  config: ClearSigningTesterConfig,
) =>
  new ContainerModule(({ bind }) => {
    // Repositories
    bind<DataFileRepository<TransactionInput>>(TYPES.TransactionFileRepository)
      .to(SolanaTransactionFileRepository)
      .inSingletonScope();

    // Signing
    bind<TransactionCraftingService>(TYPES.TransactionCraftingService)
      .to(TransactionCraftingService)
      .inSingletonScope();
    bind<SigningService>(TYPES.SigningService)
      .to(SolanaSigningService)
      .inSingletonScope();

    bind<Set<UserInteractionRequired>>(
      TYPES.SignableInteractions,
    ).toConstantValue(
      new Set<UserInteractionRequired>([
        UserInteractionRequired.SignTransaction,
      ]),
    );

    // Program-level transaction fetching (via Solana RPC)
    if (config.solanaRpc) {
      bind<SolanaRpcAdapter>(TYPES.SolanaRpcAdapter)
        .to(HttpSolanaRpcAdapter)
        .inSingletonScope();
      bind<SolanaTransactionProgramRepository>(
        TYPES.SolanaTransactionProgramRepository,
      )
        .to(DefaultSolanaTransactionProgramRepository)
        .inSingletonScope();
    }

    // DMK controller
    bind<ServiceController>(TYPES.SolanaDMKServiceController)
      .to(SolanaDMKServiceController)
      .inSingletonScope();

    bind<ServiceController[]>(TYPES.ServiceControllers)
      .toDynamicValue((context) => {
        const controllers: ServiceController[] = [];
        if (!config.speculos.externalSpeculos) {
          controllers.push(
            context.get<ServiceController>(TYPES.SpeculosServiceController),
          );
        }
        if (!config.onlySpeculos) {
          controllers.push(
            context.get<ServiceController>(TYPES.SolanaDMKServiceController),
          );
        }
        return controllers;
      })
      .inSingletonScope();
  });

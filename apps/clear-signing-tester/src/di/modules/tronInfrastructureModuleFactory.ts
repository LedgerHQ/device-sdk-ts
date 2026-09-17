import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { ContainerModule } from "inversify";

import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { TYPES } from "@root/src/di/types";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { TronTransactionFileRepository } from "@root/src/infrastructure/repositories/TronTransactionFileRepository";
import { TronDMKServiceController } from "@root/src/infrastructure/service-controllers/TronDMKServiceController";
import { TronSigningService } from "@root/src/infrastructure/services/TronSigningService";

/**
 * Tron-specific infrastructure bindings.
 * Must be loaded together with {@link sharedInfrastructureModuleFactory}.
 */
export const tronInfrastructureModuleFactory = (
  config: ClearSigningTesterConfig,
) =>
  new ContainerModule(({ bind }) => {
    // Repositories
    bind<DataFileRepository<TransactionInput>>(TYPES.TransactionFileRepository)
      .to(TronTransactionFileRepository)
      .inSingletonScope();

    // Signing
    bind<SigningService>(TYPES.SigningService)
      .to(TronSigningService)
      .inSingletonScope();

    bind<Set<UserInteractionRequired>>(
      TYPES.SignableInteractions,
    ).toConstantValue(
      new Set<UserInteractionRequired>([
        UserInteractionRequired.SignTransaction,
      ]),
    );

    // DMK controller
    bind<ServiceController>(TYPES.TronDMKServiceController)
      .to(TronDMKServiceController)
      .inSingletonScope();

    bind<ServiceController[]>(TYPES.ServiceControllers)
      .toDynamicValue((context) => {
        const controllers: ServiceController[] = [];
        controllers.push(
          context.get<ServiceController>(TYPES.SpeculinhoServiceController),
        );
        if (!config.onlySpeculos) {
          controllers.push(
            context.get<ServiceController>(TYPES.TronDMKServiceController),
          );
        }
        return controllers;
      })
      .inSingletonScope();
  });

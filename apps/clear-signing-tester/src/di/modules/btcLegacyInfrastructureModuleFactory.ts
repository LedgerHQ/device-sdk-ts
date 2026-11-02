import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import {
  type BtcLegacyErrorCodes,
  type LegacyCoinProfile,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";
import { ContainerModule } from "inversify";

import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { TYPES } from "@root/src/di/types";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { BtcLegacyTransactionFileRepository } from "@root/src/infrastructure/repositories/BtcLegacyTransactionFileRepository";
import { BtcLegacyDMKServiceController } from "@root/src/infrastructure/service-controllers/BtcLegacyDMKServiceController";
import { BtcLegacySigningService } from "@root/src/infrastructure/services/BtcLegacySigningService";

/**
 * Legacy Bitcoin infrastructure bindings, for the coin app of `profile`.
 * Must be loaded together with {@link sharedInfrastructureModuleFactory}.
 */
export const btcLegacyInfrastructureModuleFactory = (
  config: ClearSigningTesterConfig,
  profile: LegacyCoinProfile<BtcLegacyErrorCodes>,
) =>
  new ContainerModule(({ bind }) => {
    bind<LegacyCoinProfile<BtcLegacyErrorCodes>>(
      TYPES.BtcLegacyProfile,
    ).toConstantValue(profile);

    // Repositories
    bind<DataFileRepository<TransactionInput>>(TYPES.TransactionFileRepository)
      .to(BtcLegacyTransactionFileRepository)
      .inSingletonScope();

    // Signing
    bind<SigningService>(TYPES.SigningService)
      .to(BtcLegacySigningService)
      .inSingletonScope();

    bind<Set<UserInteractionRequired>>(
      TYPES.SignableInteractions,
    ).toConstantValue(
      new Set<UserInteractionRequired>([
        UserInteractionRequired.SignTransaction,
      ]),
    );

    // DMK controller
    bind<ServiceController>(TYPES.BtcLegacyDMKServiceController)
      .to(BtcLegacyDMKServiceController)
      .inSingletonScope();

    bind<ServiceController[]>(TYPES.ServiceControllers)
      .toDynamicValue((context) => {
        const controllers: ServiceController[] = [];
        controllers.push(
          context.get<ServiceController>(TYPES.SpeculinhoServiceController),
        );
        if (!config.onlySpeculos) {
          controllers.push(
            context.get<ServiceController>(TYPES.BtcLegacyDMKServiceController),
          );
        }
        return controllers;
      })
      .inSingletonScope();
  });

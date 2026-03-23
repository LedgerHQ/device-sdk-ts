import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { ContainerModule } from "inversify";

import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { TYPES } from "@root/src/di/types";
import { type CalAdapter } from "@root/src/domain/adapters/CalAdapter";
import { type EtherscanAdapter } from "@root/src/domain/adapters/EtherscanAdapter";
import { type TransactionCrafter } from "@root/src/domain/adapters/TransactionCrafter";
import { type ContractInput } from "@root/src/domain/models/ContractInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type TransactionContractRepository } from "@root/src/domain/repositories/TransactionContractRepository";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { EthersTransactionCrafter } from "@root/src/infrastructure/adapters/evm/EthersTransactionCrafter";
import { HttpCalAdapter } from "@root/src/infrastructure/adapters/external/HttpCalAdapter";
import { HttpEtherscanAdapter } from "@root/src/infrastructure/adapters/external/HttpEtherscanAdapter";
import { ContractFileRepository } from "@root/src/infrastructure/repositories/ContractFileRepository";
import { DefaultTransactionContractRepository } from "@root/src/infrastructure/repositories/DefaultTransactionContractRepository";
import { TypedDataFileRepository } from "@root/src/infrastructure/repositories/TypedDataFileRepository";
import { DMKServiceController } from "@root/src/infrastructure/service-controllers/DMKServiceController";
import { DefaultSigningService } from "@root/src/infrastructure/services/DefaultSigningService";

/**
 * Ethereum-specific infrastructure bindings.
 * Must be loaded together with {@link sharedInfrastructureModuleFactory}.
 */
export const ethereumInfrastructureModuleFactory = (
  config: ClearSigningTesterConfig,
) =>
  new ContainerModule(({ bind }) => {
    // Repositories
    bind<DataFileRepository<TypedDataInput>>(TYPES.TypedDataFileRepository)
      .to(TypedDataFileRepository)
      .inSingletonScope();
    bind<DataFileRepository<ContractInput>>(TYPES.ContractFileRepository)
      .to(ContractFileRepository)
      .inSingletonScope();
    bind<TransactionContractRepository>(TYPES.TransactionContractRepository)
      .to(DefaultTransactionContractRepository)
      .inSingletonScope();

    // Signing
    bind<SigningService>(TYPES.SigningService)
      .to(DefaultSigningService)
      .inSingletonScope();

    bind<Set<UserInteractionRequired>>(
      TYPES.SignableInteractions,
    ).toConstantValue(
      new Set<UserInteractionRequired>([
        UserInteractionRequired.SignTransaction,
        UserInteractionRequired.SignTypedData,
      ]),
    );

    // DMK controller
    bind<ServiceController>(TYPES.DMKServiceController)
      .to(DMKServiceController)
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
            context.get<ServiceController>(TYPES.DMKServiceController),
          );
        }
        return controllers;
      })
      .inSingletonScope();

    // Adapters
    bind<CalAdapter>(TYPES.CalAdapter).to(HttpCalAdapter).inSingletonScope();
    bind<EtherscanAdapter>(TYPES.EtherscanAdapter)
      .to(HttpEtherscanAdapter)
      .inSingletonScope();
    bind<TransactionCrafter>(TYPES.TransactionCrafter)
      .to(EthersTransactionCrafter)
      .inSingletonScope();
  });

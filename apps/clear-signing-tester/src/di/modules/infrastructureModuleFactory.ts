import { ContainerModule } from "inversify";

import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { TYPES } from "@root/src/di/types";
import { type CalAdapter } from "@root/src/domain/adapters/CalAdapter";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type DockerContainer } from "@root/src/domain/adapters/DockerContainer";
import { type EtherscanAdapter } from "@root/src/domain/adapters/EtherscanAdapter";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type TransactionCrafter } from "@root/src/domain/adapters/TransactionCrafter";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type TransactionContractRepository } from "@root/src/domain/repositories/TransactionContractRepository";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { SpeculosNanoController } from "@root/src/infrastructure/adapters/device-controllers/SpeculosNanoController";
import { SpeculosTouchscreenController } from "@root/src/infrastructure/adapters/device-controllers/SpeculosTouchscreenController";
import { EthersTransactionCrafter } from "@root/src/infrastructure/adapters/evm/EthersTransactionCrafter";
import { HttpCalAdapter } from "@root/src/infrastructure/adapters/external/HttpCalAdapter";
import { HttpEtherscanAdapter } from "@root/src/infrastructure/adapters/external/HttpEtherscanAdapter";
import { SpeculosScreenReader } from "@root/src/infrastructure/adapters/speculos/SpeculosScreenReader";
import { NodeDockerContainer } from "@root/src/infrastructure/adapters/system/NodeDockerContainer";
import { NodeFileReader } from "@root/src/infrastructure/adapters/system/NodeFileReader";
import { NodeJsonParser } from "@root/src/infrastructure/adapters/system/NodeJsonParser";
import { DefaultTransactionContractRepository } from "@root/src/infrastructure/repositories/DefaultTransactionContractRepository";
import { SpeculosDeviceRepository } from "@root/src/infrastructure/repositories/SpeculosDeviceRepository";
import { TransactionFileRepository } from "@root/src/infrastructure/repositories/TransactionFileRepository";
import { TypedDataFileRepository } from "@root/src/infrastructure/repositories/TypedDataFileRepository";
import { DMKServiceController } from "@root/src/infrastructure/service-controllers/DMKServiceController";
import { MainServiceController } from "@root/src/infrastructure/service-controllers/MainServiceController";
import { SpeculosServiceController } from "@root/src/infrastructure/service-controllers/SpeculosServiceController";
import { DefaultFlowOrchestrator } from "@root/src/infrastructure/services/DefaultFlowOrchestrator";
import { DefaultRetryService } from "@root/src/infrastructure/services/DefaultRetryService";
import { DefaultScreenAnalyzer } from "@root/src/infrastructure/services/DefaultScreenAnalyzer";
import { DefaultSigningService } from "@root/src/infrastructure/services/DefaultSigningService";
import { CompleteStateHandler } from "@root/src/infrastructure/state-handlers/CompleteStateHandler";
import { ErrorStateHandler } from "@root/src/infrastructure/state-handlers/ErrorStateHandler";
import { OptOutStateHandler } from "@root/src/infrastructure/state-handlers/OptOutStateHandler";
import { SignTransactionStateHandler } from "@root/src/infrastructure/state-handlers/SignTransactionStateHandler";
import { type StateHandler } from "@root/src/infrastructure/state-handlers/StateHandler";

export const infrastructureModuleFactory = (config: ClearSigningTesterConfig) =>
  new ContainerModule(({ bind }) => {
    // Repositories
    bind<DeviceRepository>(TYPES.DeviceRepository)
      .to(SpeculosDeviceRepository)
      .inSingletonScope();
    bind<DataFileRepository<TransactionInput>>(TYPES.TransactionFileRepository)
      .to(TransactionFileRepository)
      .inSingletonScope();
    bind<DataFileRepository<TypedDataInput>>(TYPES.TypedDataFileRepository)
      .to(TypedDataFileRepository)
      .inSingletonScope();
    bind<TransactionContractRepository>(TYPES.TransactionContractRepository)
      .to(DefaultTransactionContractRepository)
      .inSingletonScope();

    // Services
    bind<ScreenAnalyzerService>(TYPES.ScreenAnalyzerService)
      .to(DefaultScreenAnalyzer)
      .inSingletonScope();
    bind<SigningService>(TYPES.SigningService)
      .to(DefaultSigningService)
      .inSingletonScope();
    bind<FlowOrchestrator>(TYPES.SigningFlowOrchestrator)
      .to(DefaultFlowOrchestrator)
      .inSingletonScope();
    bind<RetryService>(TYPES.RetryService)
      .to(DefaultRetryService)
      .inSingletonScope();

    // State Handlers
    bind<StateHandler>(TYPES.CompleteStateHandler)
      .to(CompleteStateHandler)
      .inSingletonScope();
    bind<StateHandler>(TYPES.ErrorStateHandler)
      .to(ErrorStateHandler)
      .inSingletonScope();
    bind<StateHandler>(TYPES.OptOutStateHandler)
      .to(OptOutStateHandler)
      .inSingletonScope();
    bind<StateHandler>(TYPES.SignTransactionStateHandler)
      .to(SignTransactionStateHandler)
      .inSingletonScope();

    // Service Controllers
    bind<ServiceController>(TYPES.MainServiceController)
      .to(MainServiceController)
      .inSingletonScope();
    bind<ServiceController>(TYPES.DMKServiceController)
      .to(DMKServiceController)
      .inSingletonScope();
    bind<ServiceController>(TYPES.SpeculosServiceController)
      .to(SpeculosServiceController)
      .inSingletonScope();

    // Service Controllers Array (ordered for startup/shutdown)
    bind<ServiceController[]>(TYPES.ServiceControllers)
      .toDynamicValue((context) => [
        // Start order: Speculos -> DMK
        context.get<ServiceController>(TYPES.SpeculosServiceController),
        context.get<ServiceController>(TYPES.DMKServiceController),
      ])
      .inSingletonScope();

    // Adapters
    bind<ScreenReader>(TYPES.ScreenReader)
      .to(SpeculosScreenReader)
      .inSingletonScope();
    bind<FileReader>(TYPES.FileReader).to(NodeFileReader).inSingletonScope();
    bind<JsonParser>(TYPES.JsonParser).to(NodeJsonParser).inSingletonScope();
    bind<DockerContainer>(TYPES.DockerContainer)
      .to(NodeDockerContainer)
      .inSingletonScope();
    bind<CalAdapter>(TYPES.CalAdapter).to(HttpCalAdapter).inSingletonScope();
    bind<EtherscanAdapter>(TYPES.EtherscanAdapter)
      .to(HttpEtherscanAdapter)
      .inSingletonScope();
    bind<TransactionCrafter>(TYPES.TransactionCrafter)
      .to(EthersTransactionCrafter)
      .inSingletonScope();

    // Device Controllers
    // Using the new speculos-device-controller package with percentage-based coordinates
    const device = config.speculos.device;
    switch (device) {
      case "stax":
      case "flex":
      case "apex":
        // Touchscreen devices use percentage-based coordinates
        bind<DeviceController>(TYPES.DeviceController)
          .to(SpeculosTouchscreenController)
          .inSingletonScope();
        break;
      case "nanox":
      case "nanos":
      case "nanos+":
        // Button-based devices use button controller
        bind<DeviceController>(TYPES.DeviceController)
          .to(SpeculosNanoController)
          .inSingletonScope();
        break;
      default: {
        const uncoveredReferenceType: never = device;
        throw new Error(`Uncovered reference type: ${uncoveredReferenceType}`);
      }
    }
  });

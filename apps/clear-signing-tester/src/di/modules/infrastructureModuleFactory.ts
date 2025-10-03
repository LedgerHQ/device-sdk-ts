import { ContainerModule } from "inversify";

import { type ClearSigningTesterConfig } from "@root/src/di/container";
import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type DockerContainer } from "@root/src/domain/adapters/DockerContainer";
import { type Downloader } from "@root/src/domain/adapters/Downloader";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type DeviceMetadata } from "@root/src/domain/metadata/DeviceMetadata";
import {
    ApexDeviceMetadata,
    FlexDeviceMetadata,
    StaxDeviceMetadata,
} from "@root/src/domain/metadata/TouchscreenDeviceMetadata";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type TransactionFileRepository } from "@root/src/domain/repositories/TransactionFileRepository";
import { type TypedDataFileRepository } from "@root/src/domain/repositories/TypedDataFileRepository";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { SpeculosNanoController } from "@root/src/infrastructure/adapters/device-controllers/SpeculosNanoController";
import { SpeculosTouchscreenController } from "@root/src/infrastructure/adapters/device-controllers/SpeculosTouchscreenController";
import { GithubDownloader } from "@root/src/infrastructure/adapters/external/GithubDownloader";
import { SpeculosScreenReader } from "@root/src/infrastructure/adapters/speculos/SpeculosScreenReader";
import { NodeDockerContainer } from "@root/src/infrastructure/adapters/system/NodeDockerContainer";
import { NodeFileReader } from "@root/src/infrastructure/adapters/system/NodeFileReader";
import { FileTransactionRepository } from "@root/src/infrastructure/repositories/FileTransactionRepository";
import { FileTypedDataRepository } from "@root/src/infrastructure/repositories/FileTypedDataRepository";
import { SpeculosDeviceRepository } from "@root/src/infrastructure/repositories/SpeculosDeviceRepository";
import { DMKServiceController } from "@root/src/infrastructure/service-controllers/DMKServiceController";
import { MainServiceController } from "@root/src/infrastructure/service-controllers/MainServiceController";
import { SpeculosServiceController } from "@root/src/infrastructure/service-controllers/SpeculosServiceController";
import { FlowOrchestratorImpl } from "@root/src/infrastructure/services/FlowOrchestratorImpl";
import { RetryServiceImpl } from "@root/src/infrastructure/services/RetryServiceImpl";
import { ScreenAnalyzerImpl } from "@root/src/infrastructure/services/ScreenAnalyzerImpl";
import { SigningServiceImpl } from "@root/src/infrastructure/services/SigningServiceImpl";
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
        bind<TransactionFileRepository>(TYPES.TransactionFileRepository)
            .to(FileTransactionRepository)
            .inSingletonScope();
        bind<TypedDataFileRepository>(TYPES.TypedDataFileRepository)
            .to(FileTypedDataRepository)
            .inSingletonScope();

        // Services
        bind<ScreenAnalyzerService>(TYPES.ScreenAnalyzerService)
            .to(ScreenAnalyzerImpl)
            .inSingletonScope();
        bind<SigningService>(TYPES.SigningService)
            .to(SigningServiceImpl)
            .inSingletonScope();
        bind<FlowOrchestrator>(TYPES.SigningFlowOrchestrator)
            .to(FlowOrchestratorImpl)
            .inSingletonScope();
        bind<RetryService>(TYPES.RetryService)
            .to(RetryServiceImpl)
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

        // Adapters
        bind<ScreenReader>(TYPES.ScreenReader)
            .to(SpeculosScreenReader)
            .inSingletonScope();
        bind<FileReader>(TYPES.FileReader)
            .to(NodeFileReader)
            .inSingletonScope();
        bind<DockerContainer>(TYPES.DockerContainer)
            .to(NodeDockerContainer)
            .inSingletonScope();
        bind<Downloader>(TYPES.Downloader)
            .to(GithubDownloader)
            .inSingletonScope();

        // Device Controllers and Metadata
        const device = config.speculos.device;
        switch (device) {
            case "stax":
                bind<DeviceMetadata>(TYPES.DeviceMetadata).toConstantValue(
                    new StaxDeviceMetadata(),
                );
                bind<DeviceController>(TYPES.DeviceController)
                    .to(SpeculosTouchscreenController)
                    .inSingletonScope();
                break;
            case "flex":
                bind<DeviceMetadata>(TYPES.DeviceMetadata).toConstantValue(
                    new FlexDeviceMetadata(),
                );
                bind<DeviceController>(TYPES.DeviceController)
                    .to(SpeculosTouchscreenController)
                    .inSingletonScope();
                break;
            case "apex":
                bind<DeviceMetadata>(TYPES.DeviceMetadata).toConstantValue(
                    new ApexDeviceMetadata(),
                );
                bind<DeviceController>(TYPES.DeviceController)
                    .to(SpeculosTouchscreenController)
                    .inSingletonScope();
                break;
            case "nanox":
            case "nanos":
            case "nanos+":
                // Button-based devices use the nano controller
                bind<DeviceController>(TYPES.DeviceController)
                    .to(SpeculosNanoController)
                    .inSingletonScope();
                break;
            default: {
                const uncoveredReferenceType: never = device;
                throw new Error(
                    `Uncovered reference type: ${uncoveredReferenceType}`,
                );
            }
        }
    });

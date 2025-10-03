import { ContainerModule } from "inversify";

import { SpeculosDeviceRepository } from "../../infrastructure/repositories/SpeculosDeviceRepository";
import { FileTransactionRepository } from "../../infrastructure/repositories/FileTransactionRepository";
import { FileTypedDataRepository } from "../../infrastructure/repositories/FileTypedDataRepository";
import { SpeculosTouchscreenController } from "../../infrastructure/adapters/SpeculosTouchscreenController";
import { SpeculosNanoController } from "../../infrastructure/adapters/SpeculosNanoController";
import { SpeculosScreenReader } from "../../infrastructure/adapters/SpeculosScreenReader";
import { NodeFileReader } from "../../infrastructure/adapters/NodeFileReader";
import { TransactionFileRepository } from "../../domain/repositories/TransactionFileRepository";
import { TypedDataFileRepository } from "../../domain/repositories/TypedDataFileRepository";
import { TYPES } from "../types";
import { SigningServiceImpl } from "../../infrastructure/services/SigningServiceImpl";
import { DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { ScreenAnalyzerImpl } from "@root/src/infrastructure/services/ScreenAnalyzerImpl";
import { ClearSigningTesterConfig } from "../container";
import { DMKServiceController } from "@root/src/infrastructure/services/DMKServiceController";
import { FlowOrchestratorImpl } from "@root/src/infrastructure/services/FlowOrchestratorImpl";
import { CompleteStateHandler } from "@root/src/infrastructure/services/state-handlers/CompleteStateHandler";
import { ErrorStateHandler } from "@root/src/infrastructure/services/state-handlers/ErrorStateHandler";
import { OptOutStateHandler } from "@root/src/infrastructure/services/state-handlers/OptOutStateHandler";
import { SignTransactionStateHandler } from "@root/src/infrastructure/services/state-handlers/SignTransactionStateHandler";
import { RetryService } from "@root/src/domain/services/RetryService";
import { DeviceMetadata } from "../../domain/metadata/DeviceMetadata";
import { RetryServiceImpl } from "@root/src/infrastructure/services/RetryServiceImpl";
import { NodeDockerContainer } from "@root/src/infrastructure/adapters/NodeDockerContainer";
import { DockerContainer } from "@root/src/domain/adapters/DockerContainer";
import { SpeculosServiceController } from "@root/src/infrastructure/services/SpeculosServiceController";
import { GithubDownloader } from "@root/src/infrastructure/adapters/GithubDownloader";
import {
    ApexDeviceMetadata,
    FlexDeviceMetadata,
    StaxDeviceMetadata,
} from "@root/src/domain/metadata/TouchscreenDeviceMetadata";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";
import { Downloader } from "@root/src/domain/adapters/Downloader";
import { FileReader } from "@root/src/domain/adapters/FileReader";
import { ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { ServiceController } from "@root/src/domain/services/ServiceController";
import { StateHandler } from "@root/src/infrastructure/services/state-handlers/StateHandler";
import { ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";
import { SigningService } from "@root/src/domain/services/SigningService";
import { FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";

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
        bind<FileReader>(TYPES.NodeFileReader)
            .to(NodeFileReader)
            .inSingletonScope();
        bind<DockerContainer>(TYPES.DockerContainer)
            .to(NodeDockerContainer)
            .inSingletonScope();
        bind<Downloader>(TYPES.Downloader)
            .to(GithubDownloader)
            .inSingletonScope();

        // Device Controllers and Metadata
        switch (config.speculos.device) {
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
            default:
                const referenceType = config.speculos.device;
                const uncoveredReferenceType: never = referenceType;
                throw new Error(
                    `Uncovered reference type: ${uncoveredReferenceType}`,
                );
        }
    });

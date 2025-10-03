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
import { SpeculosSigningService } from "../../infrastructure/services/SpeculosSigningService";
import { DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { ScreenAnalyzerService } from "@root/src/infrastructure/services/ScreenAnalyzerService";
import { ClearSigningTesterConfig } from "../container";
import { DMKController } from "@root/src/infrastructure/services/DMKController";
import { SigningFlowOrchestrator } from "@root/src/infrastructure/services/SigningFlowOrchestrator";
import { CompleteStateHandler } from "@root/src/infrastructure/services/state-handlers/CompleteStateHandler";
import { ErrorStateHandler } from "@root/src/infrastructure/services/state-handlers/ErrorStateHandler";
import { OptOutStateHandler } from "@root/src/infrastructure/services/state-handlers/OptOutStateHandler";
import { SignTransactionStateHandler } from "@root/src/infrastructure/services/state-handlers/SignTransactionStateHandler";
import { RetryService } from "@root/src/domain/services/RetryService";
import { DeviceMetadata } from "../../domain/metadata/DeviceMetadata";
import { RetryServiceImpl } from "@root/src/infrastructure/services/RetryServiceImpl";
import { NodeDockerContainer } from "@root/src/infrastructure/adapters/NodeDockerContainer";
import { DockerContainer } from "@root/src/domain/adapters/DockerContainer";
import { SpeculosController } from "@root/src/infrastructure/services/SpeculosController";
import { GithubDownloader } from "@root/src/infrastructure/adapters/GithubDownloader";
import {
    ApexDeviceMetadata,
    FlexDeviceMetadata,
    StaxDeviceMetadata,
} from "@root/src/domain/metadata/TouchscreenDeviceMetadata";
import { DeviceController } from "@root/src/domain/adapters/DeviceController";

export const infrastructureModuleFactory = (config: ClearSigningTesterConfig) =>
    new ContainerModule(({ bind }) => {
        bind<DeviceRepository>(TYPES.DeviceRepository)
            .to(SpeculosDeviceRepository)
            .inSingletonScope();
        bind<TransactionFileRepository>(TYPES.TransactionFileRepository)
            .to(FileTransactionRepository)
            .inSingletonScope();
        bind<TypedDataFileRepository>(TYPES.TypedDataFileRepository)
            .to(FileTypedDataRepository)
            .inSingletonScope();
        bind(TYPES.ScreenAnalyzerService)
            .to(ScreenAnalyzerService)
            .inSingletonScope();
        bind(TYPES.ScreenReader).to(SpeculosScreenReader).inSingletonScope();
        bind(TYPES.NodeFileReader).to(NodeFileReader).inSingletonScope();
        bind(TYPES.SpeculosSigningService)
            .to(SpeculosSigningService)
            .inSingletonScope();
        bind(TYPES.DMKController).to(DMKController).inSingletonScope();
        bind(TYPES.SpeculosController)
            .to(SpeculosController)
            .inSingletonScope();
        bind(TYPES.SigningFlowOrchestrator)
            .to(SigningFlowOrchestrator)
            .inSingletonScope();
        bind(TYPES.CompleteStateHandler)
            .to(CompleteStateHandler)
            .inSingletonScope();
        bind(TYPES.ErrorStateHandler).to(ErrorStateHandler).inSingletonScope();
        bind(TYPES.OptOutStateHandler)
            .to(OptOutStateHandler)
            .inSingletonScope();
        bind(TYPES.SignTransactionStateHandler)
            .to(SignTransactionStateHandler)
            .inSingletonScope();
        bind<RetryService>(TYPES.RetryService)
            .to(RetryServiceImpl)
            .inSingletonScope();
        bind<DockerContainer>(TYPES.DockerContainer)
            .to(NodeDockerContainer)
            .inSingletonScope();
        bind(TYPES.Downloader).to(GithubDownloader).inSingletonScope();

        // Bind the appropriate device controller and metadata
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

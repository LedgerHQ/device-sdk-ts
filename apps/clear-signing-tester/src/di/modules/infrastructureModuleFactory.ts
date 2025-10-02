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
import { DeviceMetadataFactory } from "../../domain/metadata/DeviceMetadataFactory";
import { DeviceMetadata } from "../../domain/metadata/DeviceMetadata";
import { RetryServiceImpl } from "@root/src/infrastructure/services/RetryServiceImpl";

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
        bind(TYPES.Controller).to(DMKController).inSingletonScope();
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

        // Bind the appropriate device controller and metadata
        switch (config.deviceConnection.device) {
            case "stax":
            case "flex":
            case "apex":
                // Bind device metadata for touchscreen devices
                bind<DeviceMetadata>(TYPES.DeviceMetadata).toConstantValue(
                    DeviceMetadataFactory.createTouchscreenMetadata(
                        config.deviceConnection.device,
                    ),
                );

                // Bind touchscreen controller
                bind(TYPES.DeviceController)
                    .to(SpeculosTouchscreenController)
                    .inSingletonScope();
                break;
            case "nanox":
            case "nanos":
            case "nanos+":
                // Button-based devices use the nano controller
                bind(TYPES.DeviceController)
                    .to(SpeculosNanoController)
                    .inSingletonScope();
                break;
            default:
                const referenceType = config.deviceConnection.device;
                const uncoveredReferenceType: never = referenceType;
                throw new Error(
                    `Uncovered reference type: ${uncoveredReferenceType}`,
                );
        }
    });

import {
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
  type LoggerSubscriberService,
} from "@ledgerhq/device-management-kit";
import { speculosTransportFactory } from "@ledgerhq/device-transport-kit-speculos";
import { ContainerModule } from "inversify";

import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type DeviceSetupService } from "@root/src/domain/services/DeviceSetupService";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { getEmulatorBaseUrl } from "@root/src/domain/utils/getEmulatorBaseUrl";
import { SpeculosNanoController } from "@root/src/infrastructure/adapters/device-controllers/SpeculosNanoController";
import { SpeculosTouchscreenController } from "@root/src/infrastructure/adapters/device-controllers/SpeculosTouchscreenController";
import { SpeculosScreenReader } from "@root/src/infrastructure/adapters/speculos/SpeculosScreenReader";
import { SpeculosScreenshotSaver } from "@root/src/infrastructure/adapters/speculos/SpeculosScreenshotSaver";
import { NodeFileReader } from "@root/src/infrastructure/adapters/system/NodeFileReader";
import { NodeJsonParser } from "@root/src/infrastructure/adapters/system/NodeJsonParser";
import { SpeculosDeviceRepository } from "@root/src/infrastructure/repositories/SpeculosDeviceRepository";
import { MainServiceController } from "@root/src/infrastructure/service-controllers/MainServiceController";
import { SpeculinhoServiceController } from "@root/src/infrastructure/service-controllers/SpeculinhoServiceController";
import { DefaultDeviceSetupService } from "@root/src/infrastructure/services/DefaultDeviceSetupService";
import { DefaultFlowOrchestrator } from "@root/src/infrastructure/services/DefaultFlowOrchestrator";
import { DefaultRetryService } from "@root/src/infrastructure/services/DefaultRetryService";
import { DefaultScreenAnalyzer } from "@root/src/infrastructure/services/DefaultScreenAnalyzer";
import { CompleteStateHandler } from "@root/src/infrastructure/state-handlers/CompleteStateHandler";
import { ErrorStateHandler } from "@root/src/infrastructure/state-handlers/ErrorStateHandler";
import { OptOutStateHandler } from "@root/src/infrastructure/state-handlers/OptOutStateHandler";
import { SignTransactionStateHandler } from "@root/src/infrastructure/state-handlers/SignTransactionStateHandler";
import { type StateHandler } from "@root/src/infrastructure/state-handlers/StateHandler";

/**
 * Shared infrastructure bindings used by all chains.
 * Chain-specific factories supply signing, DMK controller, and interaction set.
 */
export const sharedInfrastructureModuleFactory = (
  config: ClearSigningTesterConfig,
) =>
  new ContainerModule(({ bind }) => {
    // Repositories
    bind<DeviceRepository>(TYPES.DeviceRepository)
      .to(SpeculosDeviceRepository)
      .inSingletonScope();

    // Services
    bind<ScreenAnalyzerService>(TYPES.ScreenAnalyzerService)
      .to(DefaultScreenAnalyzer)
      .inSingletonScope();
    bind<FlowOrchestrator>(TYPES.SigningFlowOrchestrator)
      .to(DefaultFlowOrchestrator)
      .inSingletonScope();
    bind<RetryService>(TYPES.RetryService)
      .to(DefaultRetryService)
      .inSingletonScope();
    bind<DeviceSetupService>(TYPES.DeviceSetupService)
      .to(DefaultDeviceSetupService)
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

    // Built when the container is first used, so its loggers are registered
    // before Speculinho starts. The emulator URL is only known once it has,
    // which is why the transport reads it lazily, on first discovery.
    bind<DeviceManagementKit>(TYPES.Dmk)
      .toDynamicValue((context) => {
        const speculinhoConfig = context.get<SpeculinhoConfig>(
          TYPES.SpeculinhoConfig,
        );
        const builder = new DeviceManagementKitBuilder().addTransport((args) =>
          speculosTransportFactory(
            getEmulatorBaseUrl(speculinhoConfig),
            true,
          )(args),
        );
        for (const subscriber of context.get<LoggerSubscriberService[]>(
          TYPES.LoggerSubscribers,
        )) {
          builder.addLogger(subscriber);
        }
        return builder.build();
      })
      .inSingletonScope();

    // Service Controllers (shared)
    bind<ServiceController>(TYPES.MainServiceController)
      .to(MainServiceController)
      .inSingletonScope();

    bind<ServiceController>(TYPES.SpeculinhoServiceController)
      .to(SpeculinhoServiceController)
      .inSingletonScope();

    // Adapters
    bind<ScreenReader>(TYPES.ScreenReader)
      .to(SpeculosScreenReader)
      .inSingletonScope();
    bind<ScreenshotSaver>(TYPES.ScreenshotSaver)
      .to(SpeculosScreenshotSaver)
      .inSingletonScope();
    bind<FileReader>(TYPES.FileReader).to(NodeFileReader).inSingletonScope();
    bind<JsonParser>(TYPES.JsonParser).to(NodeJsonParser).inSingletonScope();

    // Device Controllers
    const device = config.speculinho.device;
    switch (device) {
      case "stax":
      case "flex":
      case "apex":
        bind<DeviceController>(TYPES.DeviceController)
          .to(SpeculosTouchscreenController)
          .inSingletonScope();
        break;
      case "nanox":
      case "nanos":
      case "nanos+":
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

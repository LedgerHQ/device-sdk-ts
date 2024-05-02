import { ContainerModule, interfaces } from "inversify";

import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import {
  DefaultApduReceiverConstructorArgs,
  DefaultApduReceiverService,
} from "@internal/device-session/service/DefaultApduReceiverService";
import {
  DefaultApduSenderService,
  DefaultApduSenderServiceConstructorArgs,
} from "@internal/device-session/service/DefaultApduSenderService";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { GetSessionDeviceStateUseCase } from "@internal/device-session/use-case/GetSessionDeviceStateUseCase";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { StubUseCase } from "@root/src/di.stub";

import { deviceSessionTypes } from "./deviceSessionTypes";

export type DeviceSessionModuleArgs = Partial<{
  stub: boolean;
}>;

export const deviceSessionModuleFactory = (
  { stub }: DeviceSessionModuleArgs = { stub: false },
) =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind<interfaces.Factory<ApduSenderService>>(
        deviceSessionTypes.ApduSenderServiceFactory,
      ).toFactory((context) => {
        const logger = context.container.get<
          (name: string) => LoggerPublisherService
        >(loggerTypes.LoggerPublisherServiceFactory);

        return (args: DefaultApduSenderServiceConstructorArgs) => {
          return new DefaultApduSenderService(args, logger);
        };
      });

      bind<interfaces.Factory<ApduReceiverService>>(
        deviceSessionTypes.ApduReceiverServiceFactory,
      ).toFactory((context) => {
        const logger = context.container.get<
          (name: string) => LoggerPublisherService
        >(loggerTypes.LoggerPublisherServiceFactory);

        return (args: DefaultApduReceiverConstructorArgs) => {
          return new DefaultApduReceiverService(args, logger);
        };
      });

      bind(deviceSessionTypes.SessionService)
        .to(DefaultSessionService)
        .inSingletonScope();

      bind(deviceSessionTypes.GetSessionDeviceStateUseCase).to(
        GetSessionDeviceStateUseCase,
      );

      if (stub) {
        rebind(deviceSessionTypes.GetSessionDeviceStateUseCase).to(StubUseCase);
      }
    },
  );

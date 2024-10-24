import { ContainerModule, type interfaces } from "inversify";

import { type ApduReceiverService } from "@api/device-session/service/ApduReceiverService";
import { type ApduSenderService } from "@api/device-session/service/ApduSenderService";
import {
  type DefaultApduReceiverConstructorArgs,
  DefaultApduReceiverService,
} from "@api/device-session/service/DefaultApduReceiverService";
import {
  DefaultApduSenderService,
  type DefaultApduSenderServiceConstructorArgs,
} from "@api/device-session/service/DefaultApduSenderService";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { CloseSessionsUseCase } from "@internal/device-session/use-case/CloseSessionsUseCase";
import { GetDeviceSessionStateUseCase } from "@internal/device-session/use-case/GetDeviceSessionStateUseCase";
import { ListDeviceSessionsUseCase } from "@internal/device-session/use-case/ListDeviceSessionsUseCase";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
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

        return (args: DefaultApduReceiverConstructorArgs = {}) => {
          return new DefaultApduReceiverService(args, logger);
        };
      });

      bind(deviceSessionTypes.DeviceSessionService)
        .to(DefaultDeviceSessionService)
        .inSingletonScope();

      bind(deviceSessionTypes.GetDeviceSessionStateUseCase).to(
        GetDeviceSessionStateUseCase,
      );
      bind(deviceSessionTypes.CloseSessionsUseCase).to(CloseSessionsUseCase);

      bind(deviceSessionTypes.ListDeviceSessionsUseCase).to(
        ListDeviceSessionsUseCase,
      );

      if (stub) {
        rebind(deviceSessionTypes.GetDeviceSessionStateUseCase).to(StubUseCase);
        rebind(deviceSessionTypes.ListDeviceSessionsUseCase).to(StubUseCase);
      }
    },
  );

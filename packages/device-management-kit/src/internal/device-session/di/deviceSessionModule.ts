import { ContainerModule, type interfaces } from "inversify";

import { type ApduReceiverService } from "@api/device-session/service/ApduReceiverService";
import { type ApduReceiverConstructorArgs } from "@api/device-session/service/ApduReceiverService";
import { type ApduSenderService } from "@api/device-session/service/ApduSenderService";
import { type ApduSenderServiceConstructorArgs } from "@api/device-session/service/ApduSenderService";
import { ToggleDeviceSessionRefresherUseCase } from "@api/device-session/use-case/ToggleDeviceSessionRefresher";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DefaultApduReceiverService } from "@internal/device-session/service/DefaultApduReceiverService";
import { DefaultApduSenderService } from "@internal/device-session/service/DefaultApduSenderService";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { CloseSessionsUseCase } from "@internal/device-session/use-case/CloseSessionsUseCase";
import { GetDeviceSessionStateUseCase } from "@internal/device-session/use-case/GetDeviceSessionStateUseCase";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
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

        return (args: ApduSenderServiceConstructorArgs) => {
          return new DefaultApduSenderService(args, logger);
        };
      });

      bind<interfaces.Factory<ApduReceiverService>>(
        deviceSessionTypes.ApduReceiverServiceFactory,
      ).toFactory((context) => {
        const logger = context.container.get<
          (name: string) => LoggerPublisherService
        >(loggerTypes.LoggerPublisherServiceFactory);

        return (args: ApduReceiverConstructorArgs = {}) => {
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
      bind(deviceSessionTypes.ToggleDeviceSessionRefresherUseCase).to(
        ToggleDeviceSessionRefresherUseCase,
      );

      if (stub) {
        rebind(deviceSessionTypes.GetDeviceSessionStateUseCase).to(StubUseCase);
        rebind(deviceSessionTypes.ToggleDeviceSessionRefresherUseCase).to(
          StubUseCase,
        );
      }
    },
  );

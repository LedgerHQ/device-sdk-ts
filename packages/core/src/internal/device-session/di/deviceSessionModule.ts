import { ContainerModule, interfaces } from "inversify";

import { Session } from "@internal/device-session/model/Session";
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
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { deviceSessionTypes } from "./deviceSessionTypes";

export type DeviceSessionModuleArgs = Partial<{
  stub: boolean;
  sessions: Session[];
}>;

export const deviceSessionModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
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
    },
  );

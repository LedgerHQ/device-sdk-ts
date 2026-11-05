import { ContainerModule, type Factory } from "inversify";

import { type ApduReceiverService } from "@api/device-session/service/ApduReceiverService";
import { type ApduReceiverConstructorArgs } from "@api/device-session/service/ApduReceiverService";
import { type ApduSenderService } from "@api/device-session/service/ApduSenderService";
import { type ApduSenderServiceConstructorArgs } from "@api/device-session/service/ApduSenderService";
import { DisableDeviceSessionRefresherUseCase } from "@api/device-session/use-case/DisableDeviceSessionRefresher";
import { DefaultApduReceiverService } from "@internal/device-session/service/DefaultApduReceiverService";
import { DefaultApduSenderService } from "@internal/device-session/service/DefaultApduSenderService";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { CloseSessionsUseCase } from "@internal/device-session/use-case/CloseSessionsUseCase";
import { GetDeviceSessionStateUseCase } from "@internal/device-session/use-case/GetDeviceSessionStateUseCase";
import { UnsafeBypassIntentQueueUseCase } from "@internal/device-session/use-case/UnsafeBypassIntentQueueUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { deviceSessionTypes } from "./deviceSessionTypes";

export type DeviceSessionModuleArgs = Partial<{
  stub: boolean;
}>;

export const deviceSessionModuleFactory = (
  { stub }: DeviceSessionModuleArgs = { stub: false },
) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind<Factory<ApduSenderService>>(
      deviceSessionTypes.ApduSenderServiceFactory,
    ).toFactory(() => {
      return (args: ApduSenderServiceConstructorArgs) => {
        return new DefaultApduSenderService(args);
      };
    });

    bind<Factory<ApduReceiverService>>(
      deviceSessionTypes.ApduReceiverServiceFactory,
    ).toFactory(() => {
      return (args: ApduReceiverConstructorArgs = {}) => {
        return new DefaultApduReceiverService(args);
      };
    });

    bind(deviceSessionTypes.DeviceSessionService)
      .to(DefaultDeviceSessionService)
      .inSingletonScope();

    bind(deviceSessionTypes.GetDeviceSessionStateUseCase).to(
      GetDeviceSessionStateUseCase,
    );
    bind(deviceSessionTypes.CloseSessionsUseCase).to(CloseSessionsUseCase);
    bind(deviceSessionTypes.DisableDeviceSessionRefresherUseCase).to(
      DisableDeviceSessionRefresherUseCase,
    );
    bind(deviceSessionTypes.UnsafeBypassIntentQueueUseCase).to(
      UnsafeBypassIntentQueueUseCase,
    );

    if (stub) {
      rebindSync(deviceSessionTypes.GetDeviceSessionStateUseCase).to(
        StubUseCase,
      );
      rebindSync(deviceSessionTypes.DisableDeviceSessionRefresherUseCase).to(
        StubUseCase,
      );
      rebindSync(deviceSessionTypes.UnsafeBypassIntentQueueUseCase).to(
        StubUseCase,
      );
    }
  });

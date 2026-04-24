import { type ContextModule } from "@ledgerhq/context-module";
import {
  CallTaskInAppDeviceAction,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAddressTaskError } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAddressCommandResponse } from "@api/app-binder/GetAddressCommandTypes";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendGetAddressTask } from "@internal/app-binder/task/SendGetAddressTask";

export const GetAddressDeviceActionFactory = (args: {
  derivationPath: string;
  checkOnDevice: boolean;
  returnChainCode: boolean;
  skipOpenApp: boolean;
  chainId?: number;
  contextModule: ContextModule;
  loggerFactory: (tag: string) => LoggerPublisherService;
}): CallTaskInAppDeviceAction<
  GetAddressCommandResponse,
  GetAddressTaskError,
  UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
> => {
  return new CallTaskInAppDeviceAction<
    GetAddressCommandResponse,
    GetAddressTaskError,
    UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
  >({
    input: {
      task: async (internalApi) =>
        new SendGetAddressTask(internalApi, {
          contextModule: args.contextModule,
          derivationPath: args.derivationPath,
          checkOnDevice: args.checkOnDevice,
          returnChainCode: args.returnChainCode,
          chainId: args.chainId,
          loggerFactory: args.loggerFactory,
        }).run(),
      appName: APP_NAME,
      requiredUserInteraction: args.checkOnDevice
        ? UserInteractionRequired.VerifyAddress
        : UserInteractionRequired.None,
      skipOpenApp: args.skipOpenApp,
    },
  });
};

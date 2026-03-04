import {
  CallTaskInAppDeviceAction,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendSignPersonalMessageTask } from "@internal/app-binder/task/SendSignPersonalMessageTask";

export const SignPersonalMessageDeviceActionFactory = (args: {
  derivationPath: string;
  message: string | Uint8Array;
  skipOpenApp: boolean;
  loggerFactory: (tag: string) => LoggerPublisherService;
}): CallTaskInAppDeviceAction<
  Signature,
  EthErrorCodes,
  UserInteractionRequired.SignPersonalMessage
> => {
  const taskLogger = args.loggerFactory("SendSignPersonalMessageTask");
  return new CallTaskInAppDeviceAction<
    Signature,
    EthErrorCodes,
    UserInteractionRequired.SignPersonalMessage
  >({
    input: {
      task: async (internalApi) =>
        new SendSignPersonalMessageTask(internalApi, {
          derivationPath: args.derivationPath,
          message: args.message,
          logger: taskLogger,
        }).run(),
      appName: APP_NAME,
      requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
      skipOpenApp: args.skipOpenApp,
    },
  });
};

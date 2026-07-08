import {
  CallTaskInAppDeviceAction,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type SignMessageDAOutput,
  type SignMessageTaskError,
} from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignMessageVersion } from "@api/model/MessageOptions";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendSignMessageTask } from "@internal/app-binder/task/SendSignMessageTask";

export const SignMessageDeviceActionFactory = (args: {
  derivationPath: string;
  message: string | Uint8Array;
  skipOpenApp: boolean;
  version?: SignMessageVersion;
  appDomain?: string;
  signers?: Uint8Array[];
  logger?: LoggerPublisherService;
}): CallTaskInAppDeviceAction<
  SignMessageDAOutput,
  SignMessageTaskError,
  UserInteractionRequired.SignPersonalMessage
> =>
  new CallTaskInAppDeviceAction<
    SignMessageDAOutput,
    SignMessageTaskError,
    UserInteractionRequired.SignPersonalMessage
  >({
    input: {
      task: async (internalApi) =>
        new SendSignMessageTask(internalApi, {
          derivationPath: args.derivationPath,
          sendingData: args.message,
          version: args.version,
          appDomain: args.appDomain,
          signers: args.signers,
        }).run(),
      appName: APP_NAME,
      requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
      skipOpenApp: args.skipOpenApp,
    },
    logger: args.logger,
  });

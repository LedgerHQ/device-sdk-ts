import {
  CallTaskInAppDeviceAction,
  type CommandErrorResult,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";

/** Every error the signing task can end on. */
type SignTransactionTaskError = CommandErrorResult<XrpErrorCodes>["error"];

/**
 * Build the device action that opens the XRP app, if needed, and runs
 * {@link SendSignTransactionTask} on it.
 *
 * Signing always ends on a confirmation screen, so the caller is told to
 * prompt for it regardless of the arguments.
 */
export const SignTransactionDeviceActionFactory = (args: {
  derivationPath: string;
  transaction: Uint8Array;
  skipOpenApp: boolean;
  loggerFactory: (tag: string) => LoggerPublisherService;
}): CallTaskInAppDeviceAction<
  Signature,
  SignTransactionTaskError,
  UserInteractionRequired.SignTransaction
> =>
  new CallTaskInAppDeviceAction<
    Signature,
    SignTransactionTaskError,
    UserInteractionRequired.SignTransaction
  >({
    input: {
      task: async (internalApi) =>
        new SendSignTransactionTask(internalApi, {
          derivationPath: args.derivationPath,
          serializedTransaction: args.transaction,
          loggerFactory: args.loggerFactory,
        }).run(),
      appName: APP_NAME,
      requiredUserInteraction: UserInteractionRequired.SignTransaction,
      skipOpenApp: args.skipOpenApp,
    },
    logger: args.loggerFactory("SignTransactionDeviceAction"),
  });

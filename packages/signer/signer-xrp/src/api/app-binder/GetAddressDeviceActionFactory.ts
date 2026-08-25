import {
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";

/**
 * Build the device action that opens the XRP app, if needed, and runs
 * {@link GetAddressCommand} on it.
 *
 * The address is only shown on the device when `checkOnDevice` is set, so that
 * is also what decides whether the caller has to prompt the user.
 */
export const GetAddressDeviceActionFactory = (
  args: GetAddressCommandArgs & { skipOpenApp: boolean },
): SendCommandInAppDeviceAction<
  GetAddressCommandResponse,
  GetAddressCommandArgs,
  XrpErrorCodes,
  UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
> => {
  const { skipOpenApp, ...commandArgs } = args;

  return new SendCommandInAppDeviceAction({
    input: {
      command: new GetAddressCommand(commandArgs),
      appName: APP_NAME,
      requiredUserInteraction: commandArgs.checkOnDevice
        ? UserInteractionRequired.VerifyAddress
        : UserInteractionRequired.None,
      skipOpenApp,
    },
  });
};

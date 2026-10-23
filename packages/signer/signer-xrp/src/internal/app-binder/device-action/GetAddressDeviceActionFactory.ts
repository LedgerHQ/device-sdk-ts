import {
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";
import { type Curve } from "@api/model/Curve";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { APP_NAME, DEFAULT_CURVE } from "@internal/app-binder/constants";

/**
 * Build the device action that opens the XRP app, if needed, and runs
 * {@link GetAddressCommand} on it.
 *
 * The address is only shown on the device when `checkOnDevice` is set, so that
 * is also what decides whether the caller has to prompt the user.
 */
export const GetAddressDeviceActionFactory = (args: {
  derivationPath: string;
  checkOnDevice: boolean;
  returnChainCode: boolean;
  skipOpenApp: boolean;
  /** Curve to derive the key with. Defaults to `Curve.Secp256k1`. */
  curve?: Curve;
}): SendCommandInAppDeviceAction<
  GetAddressCommandResponse,
  GetAddressCommandArgs,
  XrpErrorCodes,
  UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
> =>
  new SendCommandInAppDeviceAction<
    GetAddressCommandResponse,
    GetAddressCommandArgs,
    XrpErrorCodes,
    UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
  >({
    input: {
      command: new GetAddressCommand({
        derivationPath: args.derivationPath,
        checkOnDevice: args.checkOnDevice,
        returnChainCode: args.returnChainCode,
        curve: args.curve ?? DEFAULT_CURVE,
      }),
      appName: APP_NAME,
      requiredUserInteraction: args.checkOnDevice
        ? UserInteractionRequired.VerifyAddress
        : UserInteractionRequired.None,
      skipOpenApp: args.skipOpenApp,
    },
  });

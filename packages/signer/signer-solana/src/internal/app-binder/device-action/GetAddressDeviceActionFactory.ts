import {
  type LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type PublicKey } from "@api/model/PublicKey";
import {
  GetPubKeyCommand,
  type GetPubKeyCommandArgs,
} from "@internal/app-binder/command/GetPubKeyCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";

export const GetAddressDeviceActionFactory = (args: {
  derivationPath: string;
  checkOnDevice: boolean;
  skipOpenApp: boolean;
  logger?: LoggerPublisherService;
}): SendCommandInAppDeviceAction<
  PublicKey,
  GetPubKeyCommandArgs,
  SolanaAppErrorCodes,
  UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
> =>
  new SendCommandInAppDeviceAction<
    PublicKey,
    GetPubKeyCommandArgs,
    SolanaAppErrorCodes,
    UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
  >({
    input: {
      command: new GetPubKeyCommand({
        derivationPath: args.derivationPath,
        checkOnDevice: args.checkOnDevice,
      }),
      appName: APP_NAME,
      requiredUserInteraction: args.checkOnDevice
        ? UserInteractionRequired.VerifyAddress
        : UserInteractionRequired.None,
      skipOpenApp: args.skipOpenApp,
    },
    logger: args.logger,
  });

import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { APP_NAME } from "@internal/app-binder/constants";
import { externalTypes } from "@internal/externalTypes";

import { GetAppConfigCommand } from "./command/GetAppConfigCommand";
import { GetPublicKeyCommand } from "./command/GetPublicKeyCommand";
import { SignTransactionCommand } from "./command/SignTransactionCommand";

@injectable()
export class HederaAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAppConfig(args: { skipOpenApp: boolean }): GetAppConfigDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigCommand(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getPublicKey(args: {
    keyIndex: number;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetPublicKeyDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetPublicKeyCommand({
            keyIndex: args.keyIndex,
            checkOnDevice: args.checkOnDevice,
          }),
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signTransaction(args: {
    keyIndex: number;
    transactionBody: Uint8Array;
    skipOpenApp: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignTransactionCommand({
            keyIndex: args.keyIndex,
            transactionBody: args.transactionBody,
          }),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}

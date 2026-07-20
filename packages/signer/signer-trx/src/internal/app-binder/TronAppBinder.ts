import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignTransactionHashCommand } from "@internal/app-binder/command/SignTransactionHashCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { SignPersonalMessageTask } from "@internal/app-binder/task/SignPersonalMessageTask";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class TronAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand({
            derivationPath: args.derivationPath,
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
    derivationPath: string;
    transaction: Uint8Array;
    skipOpenApp?: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SignTransactionTask(internalApi, {
              derivationPath: args.derivationPath,
              transaction: args.transaction,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }

  signTransactionHash(args: {
    derivationPath: string;
    transactionHash: Uint8Array;
    skipOpenApp?: boolean;
  }): SignTransactionHashDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignTransactionHashCommand({
            derivationPath: args.derivationPath,
            transactionHash: args.transactionHash,
          }),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }

  signPersonalMessage(args: {
    derivationPath: string;
    message: Uint8Array;
    skipOpenApp?: boolean;
  }): SignPersonalMessageDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SignPersonalMessageTask(internalApi, {
              derivationPath: args.derivationPath,
              message: args.message,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigurationCommand(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: false,
        },
      }),
    });
  }
}

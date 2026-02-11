import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  CallTaskInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { externalTypes } from "@internal/externalTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";

import { GetAppConfigCommand } from "./command/GetAppConfigCommand";
import { GetAddressCommand } from "./command/GetAddressCommand";
import { SignTransactionTask } from "./task/SignTransactionTask";
import { SignMessageTask } from "./task/SignMessageTask";

@injectable()
export class CeloAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAppConfig(args: {
    skipOpenApp: boolean;
  }): GetAppConfigDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigCommand(),
          appName: "Celo",
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand(args),
          appName: "Celo",
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
            new SignTransactionTask(internalApi, args).run(),
          appName: "Celo",
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }

  signMessage(args: {
    derivationPath: string;
    message: string | Uint8Array;
    skipOpenApp: boolean;
  }): SignMessageDAReturnType {
    const messageBytes =
      typeof args.message === "string"
        ? new TextEncoder().encode(args.message)
        : args.message;

    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SignMessageTask(internalApi, {
              derivationPath: args.derivationPath,
              message: messageBytes,
            }).run(),
          appName: "Celo",
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}

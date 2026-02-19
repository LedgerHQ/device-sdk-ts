import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  CallTaskInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { externalTypes } from "@internal/externalTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";

import { SignTransactionTask } from "./task/SignTransactionTask";
import { SignMessageCommand } from "./command/SignMessageCommand";

@injectable()
export class HyperliquidAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

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
          appName: "Hyperliquid",
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
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignMessageCommand(args),
          appName: "Hyperliquid",
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}

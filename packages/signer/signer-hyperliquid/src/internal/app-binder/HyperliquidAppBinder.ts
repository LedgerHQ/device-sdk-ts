import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type DeviceSessionId,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type SignActionsDAReturnType } from "@api/app-binder/SignActionsDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { SignActionsTask } from "./task/SignActionsTask";

@injectable()
export class HyperliquidAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  signActions(args: {
    derivationPath: string;
    Actions: Uint8Array;
    skipOpenApp?: boolean;
  }): SignActionsDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SignActionsTask(internalApi, args).run(),
          appName: "Hyperliquid",
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }
}

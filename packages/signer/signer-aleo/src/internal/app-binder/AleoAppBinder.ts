import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetViewKeyDAReturnType } from "@api/app-binder/GetViewKeyDeviceActionTypes";
import { type SignFeeIntentDAReturnType } from "@api/app-binder/SignFeeIntentDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignRootIntentDAReturnType } from "@api/app-binder/SignRootIntentDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { GetAppConfigCommand } from "./command/GetAppConfigCommand";
import { GetViewKeyCommand } from "./command/GetViewKeyCommand";
import { SignFeeIntentCommand } from "./command/SignFeeIntentCommand";
import { SignMessageCommand } from "./command/SignMessageCommand";
import { SignRootIntentCommand } from "./command/SignRootIntentCommand";

@injectable()
export class AleoAppBinder {
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
          appName: "Aleo",
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
          appName: "Aleo",
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getViewKey(args: {
    derivationPath: string;
    skipOpenApp: boolean;
  }): GetViewKeyDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetViewKeyCommand(args),
          appName: "Aleo",
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
          skipOpenApp: args.skipOpenApp,
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
          appName: "Aleo",
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signRootIntent(args: {
    derivationPath: string;
    rootIntent: Uint8Array;
    skipOpenApp: boolean;
  }): SignRootIntentDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignRootIntentCommand(args),
          appName: "Aleo",
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signFeeIntent(args: {
    feeIntent: Uint8Array;
    skipOpenApp: boolean;
  }): SignFeeIntentDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignFeeIntentCommand(args),
          appName: "Aleo",
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}

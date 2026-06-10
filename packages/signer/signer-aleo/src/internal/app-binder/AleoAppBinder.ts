import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetTvkDAReturnType } from "@api/app-binder/GetTvkDeviceActionTypes";
import { type GetViewKeyDAReturnType } from "@api/app-binder/GetViewKeyDeviceActionTypes";
import { type SignFeeIntentDAReturnType } from "@api/app-binder/SignFeeIntentDeviceActionTypes";
import { type SignNestedCallDAReturnType } from "@api/app-binder/SignNestedCallDeviceActionTypes";
import { type SignRootIntentDAReturnType } from "@api/app-binder/SignRootIntentDeviceActionTypes";
import { APP_NAME } from "@internal/app-binder/constants";
import { externalTypes } from "@internal/externalTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { GetAppConfigCommand } from "./command/GetAppConfigCommand";
import { GetTvkCommand } from "./command/GetTvkCommand";
import { GetViewKeyCommand } from "./command/GetViewKeyCommand";
import { SignFeeIntentTask } from "./task/SignFeeIntentTask";
import { SignNestedCallTask } from "./task/SignNestedCallTask";
import { SignRootIntentTask } from "./task/SignRootIntentTask";

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
          appName: APP_NAME,
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
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getTvk(args: {
    derivationPath: string;
    transitionIndex?: number;
    skipOpenApp: boolean;
  }): GetTvkDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetTvkCommand(args),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
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
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
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
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: (internalApi) =>
            new SignRootIntentTask(internalApi, {
              derivationPath: args.derivationPath,
              rootIntent: args.rootIntent,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signNestedCall(args: {
    nestedCallRequest: Uint8Array;
    skipOpenApp: boolean;
  }): SignNestedCallDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: (internalApi) =>
            new SignNestedCallTask(internalApi, {
              nestedCallRequest: args.nestedCallRequest,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
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
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: (internalApi) =>
            new SignFeeIntentTask(internalApi, {
              feeIntent: args.feeIntent,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}

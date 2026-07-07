import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type DeviceSessionId,
  type InternalApi,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetFullViewingKeyDAReturnType } from "@api/app-binder/GetFullViewingKeyDeviceActionTypes";
import { type GetTrustedInputDAReturnType } from "@api/app-binder/GetTrustedInputActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPcztTransactionDAReturnType } from "@api/app-binder/SignPcztTransactionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type ZcashFullViewingKeyMode } from "@api/model/FullViewingKeyOptions";
import { type PcztTransaction } from "@api/model/PcztTransaction";
import { APP_NAME } from "@internal/app-binder/constants";
import { externalTypes } from "@internal/externalTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { GetAppConfigCommand } from "./command/GetAppConfigCommand";
import { SignMessageCommand } from "./command/SignMessageCommand";
import { GetFullViewingKeyTask } from "./task/GetFullViewingKeyTask";
import { GetTrustedInputTask } from "./task/GetTrustedInputTask";
import { SignPcztTransactionTask } from "./task/SignPcztTransactionTask";
import { SignTransactionTask } from "./task/SignTransactionTask";

@injectable()
export class ZcashAppBinder {
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

  getFullViewingKey(args: {
    derivationPath: string;
    mode: ZcashFullViewingKeyMode;
    skipOpenApp: boolean;
  }): GetFullViewingKeyDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi: InternalApi) =>
            new GetFullViewingKeyTask(internalApi, {
              derivationPath: args.derivationPath,
              mode: args.mode,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signTransaction(args: {
    transactionArg: LegacyCreateTransactionArg;
    skipOpenApp?: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi: InternalApi) =>
            new SignTransactionTask(internalApi, args).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }

  signPcztTransaction(args: {
    transaction: PcztTransaction;
    skipOpenApp?: boolean;
  }): SignPcztTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi: InternalApi) =>
            new SignPcztTransactionTask(internalApi, {
              transaction: args.transaction,
            }).run(),
          appName: APP_NAME,
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
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getTrustedInput(args: {
    transaction: Uint8Array;
    indexLookup?: number;
    skipOpenApp?: boolean;
  }): GetTrustedInputDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi: InternalApi) =>
            new GetTrustedInputTask(internalApi, args).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }
}

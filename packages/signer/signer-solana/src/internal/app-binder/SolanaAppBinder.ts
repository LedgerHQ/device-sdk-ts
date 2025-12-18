import { type ContextModule } from "@ledgerhq/context-module";
import {
  CallTaskInAppDeviceAction,
  DeviceManagementKit,
  type DeviceSessionId,
  LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { SolanaTransactionOptionalConfig } from "@api/model/SolanaTransactionOptionalConfig";
import { Transaction } from "@api/model/Transaction";
import { SendSignMessageTask } from "@internal/app-binder/task/SendSignMessageTask";
import { externalTypes } from "@internal/externalTypes";

import { GetAppConfigurationCommand } from "./command/GetAppConfigurationCommand";
import { GetPubKeyCommand } from "./command/GetPubKeyCommand";
import { GenerateTransactionDeviceAction } from "./device-action/GenerateTransactionDeviceAction";
import { SignTransactionDeviceAction } from "./device-action/SignTransactionDeviceAction";

@injectable()
export class SolanaAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.ContextModule) private contextModule: ContextModule,
    @inject(externalTypes.DmkLoggerFactory)
    private dmkLoggerFactory: (tag: string) => LoggerPublisherService,
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
          command: new GetPubKeyCommand(args),
          appName: "Solana",
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
    transaction: Transaction;
    solanaTransactionOptionalConfig?: SolanaTransactionOptionalConfig;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          transaction: args.transaction,
          transactionOptions: args.solanaTransactionOptionalConfig,
          contextModule: this.contextModule,
          loggerFactory: this.dmkLoggerFactory,
        },
      }),
    });
  }

  generateTransaction(args: {
    derivationPath: string;
    skipOpenApp: boolean;
  }): GenerateTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new GenerateTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          skipOpenApp: args.skipOpenApp,
          contextModule: this.contextModule,
        },
      }),
    });
  }

  signMessage(args: {
    derivationPath: string;
    message: string;
    skipOpenApp: boolean;
  }): SignMessageDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendSignMessageTask(internalApi, {
              derivationPath: args.derivationPath,
              sendingData: new TextEncoder().encode(args.message),
            }).run(),
          appName: "Solana",
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
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
          appName: "Solana",
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: false,
        },
      }),
    });
  }
}

import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { externalTypes } from "@internal/externalTypes";

import { GetAppConfigurationCommand } from "./command/GetAppConfigurationCommand";
import { GetPubKeyCommand } from "./command/GetPubKeyCommand";
import { SignTransactionDeviceAction } from "./device-action/SignTransactionDeviceAction";

@injectable()
export class SolanaAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
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
        },
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    transaction: Transaction;
    options?: TransactionOptions;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          transaction: args.transaction,
          options: args.options ?? {},
        },
      }),
    });
  }

  signMessage(_args: {
    derivationPath: string;
    message: string;
  }): SignMessageDAReturnType {
    return {} as SignMessageDAReturnType;
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigurationCommand(),
          appName: "Solana",
          requiredUserInteraction: UserInteractionRequired.None,
        },
      }),
    });
  }
}

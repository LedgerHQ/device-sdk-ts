import {
  DeviceSdk,
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
import { externalTypes } from "@internal/externalTypes";

import { GetPubKeyCommand } from "./command/GetPubKeyCommand";

@injectable()
export class SolanaAppBinder {
  constructor(
    @inject(externalTypes.Sdk) private sdk: DeviceSdk,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
  }): GetAddressDAReturnType {
    return this.sdk.executeDeviceAction({
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

  signTransaction(_args: {
    derivationPath: string;
    transaction: Transaction;
  }): SignTransactionDAReturnType {
    return {} as SignTransactionDAReturnType;
  }

  signMessage(_args: {
    derivationPath: string;
    message: string;
  }): SignMessageDAReturnType {
    return {} as SignMessageDAReturnType;
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return {} as GetAppConfigurationDAReturnType;
  }
}

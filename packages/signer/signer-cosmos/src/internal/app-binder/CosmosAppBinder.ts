import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { externalTypes } from "@internal/externalTypes";

import { GetPubKeyCommand } from "./command/GetPubKeyCommand";
import { SignTransactionDeviceAction } from "./device-action/SignTransactionDeviceAction";

@injectable()
export class CosmosAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAddress(args: {
    derivationPath: string;
    prefix: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetPubKeyCommand(args),
          appName: "Cosmos",
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
    serializedSignDoc: Uint8Array;
    options?: TransactionOptions;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          serializedSignDoc: args.serializedSignDoc,
          options: args.options ?? {},
        },
      }),
    });
  }
}

import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import {
  GetExtendedPublicKeyDAInput,
  GetExtendedPublicKeyDAReturnType,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { Psbt } from "@api/model/Psbt";
import { Wallet } from "@api/model/Wallet";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
import { SignPsbtDeviceAction } from "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction";
import { externalTypes } from "@internal/externalTypes";

import { SignMessageDeviceAction } from "./device-action/SignMessage/SignMessageDeviceAction";

@injectable()
export class BtcAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getExtendedPublicKey(
    args: GetExtendedPublicKeyDAInput,
  ): GetExtendedPublicKeyDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetExtendedPublicKeyCommand(args),
          appName: "Bitcoin",
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
        },
      }),
    });
  }

  signMessage(args: {
    derivationPath: string;
    message: string;
  }): SignMessageDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignMessageDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          message: args.message,
        },
      }),
    });
  }

  signPsbt(args: { psbt: Psbt; wallet: Wallet }): SignPsbtDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignPsbtDeviceAction({
        input: {
          psbt: args.psbt,
          wallet: args.wallet,
        },
      }),
    });
  }
}

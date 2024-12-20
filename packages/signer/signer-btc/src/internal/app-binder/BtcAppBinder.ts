import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import {
  GetExtendedPublicKeyDAInput,
  GetExtendedPublicKeyReturnType,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/index";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
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
  ): GetExtendedPublicKeyReturnType {
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
}

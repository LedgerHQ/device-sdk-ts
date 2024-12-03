import {
  DeviceManagementKit,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject } from "inversify";

import { GetPublicKeyCommandArgs } from "@api/app-binder/GetPublicKeyCommandTypes";
import { GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import type { GetWalletIdCommandArgs } from "@api/app-binder/GetWalletIdCommandTypes";
import { GetWalletIdDAReturnType } from "@api/app-binder/GetWalletIdDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { SignerNear } from "@api/SignerNear";
import { GetPublicKeyCommand } from "@internal/app-binder/command/GetPublicKeyCommand";
import { GetVersionCommand } from "@internal/app-binder/command/GetVersionCommand";
import { GetWalletIdCommand } from "@internal/app-binder/command/GetWalletIdCommand";
import { SignMessageDeviceAction } from "@internal/app-binder/device-action/SignMessageDeviceAction";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransactionDeviceAction";
import { SignMessageTaskArgs } from "@internal/app-binder/task/SignMessageTask";
import { SignTransactionTaskArgs } from "@internal/app-binder/task/SignTransactionTask";
import { externalTypes } from "@internal/externalTypes";

export class DefaultSignerNear implements SignerNear {
  constructor(
    @inject(externalTypes.Dmk) private _dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private _sessionId: string,
  ) {}
  getVersion(inspect?: boolean): GetVersionDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetVersionCommand(),
          appName: "NEAR",
          requiredUserInteraction: UserInteractionRequired.None,
        },
        inspect,
      }),
    });
  }
  getWalletId(
    args: GetWalletIdCommandArgs,
    inspect?: boolean,
  ): GetWalletIdDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetWalletIdCommand(args),
          appName: "NEAR",
          requiredUserInteraction: UserInteractionRequired.None,
        },
        inspect,
      }),
    });
  }
  getPublicKey(
    args: GetPublicKeyCommandArgs,
    inspect?: boolean,
  ): GetPublicKeyDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetPublicKeyCommand(args),
          appName: "NEAR",
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
        },
        inspect,
      }),
    });
  }
  signMessage(
    args: SignMessageTaskArgs,
    inspect?: boolean,
  ): SignMessageDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignMessageDeviceAction({
        input: {
          args,
        },
        inspect,
      }),
    });
  }
  signTransaction(
    args: SignTransactionTaskArgs,
    inspect?: boolean,
  ): SignTransactionDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: { args },
        inspect,
      }),
    });
  }
}

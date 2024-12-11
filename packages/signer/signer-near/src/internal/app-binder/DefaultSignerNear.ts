import {
  DeviceManagementKit,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject } from "inversify";

import { GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { GetWalletIdDAReturnType } from "@api/app-binder/GetWalletIdDeviceActionTypes";
import { SignDelegateDAReturnType } from "@api/app-binder/SignDelegateDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { AddressOptions } from "@api/model/AddressOptions";
import { DeviceActionOptions } from "@api/model/DeviceActionOptions";
import { SignerNear } from "@api/SignerNear";
import { GetPublicKeyCommand } from "@internal/app-binder/command/GetPublicKeyCommand";
import { GetVersionCommand } from "@internal/app-binder/command/GetVersionCommand";
import { GetWalletIdCommand } from "@internal/app-binder/command/GetWalletIdCommand";
import { SignDelegateDeviceAction } from "@internal/app-binder/device-action/SignDelegateDeviceAction";
import { SignMessageDeviceAction } from "@internal/app-binder/device-action/SignMessageDeviceAction";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransactionDeviceAction";
import { SignMessageTaskArgs } from "@internal/app-binder/task/SignMessageTask";
import { SignTransactionTaskArgs } from "@internal/app-binder/task/SignTransactionTask";
import { externalTypes } from "@internal/externalTypes";

import { SignDelegateTaskArgs } from "./task/SignDelegateTask";

export class DefaultSignerNear implements SignerNear {
  constructor(
    @inject(externalTypes.Dmk) private _dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private _sessionId: string,
  ) {}

  getVersion({ inspect }: DeviceActionOptions): GetVersionDAReturnType {
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
    derivationPath: string,
    { inspect }: DeviceActionOptions,
  ): GetWalletIdDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetWalletIdCommand({
            derivationPath,
          }),
          appName: "NEAR",
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
        },
        inspect,
      }),
    });
  }
  getPublicKey(
    derivationPath: string,
    { inspect, checkOnDevice = false }: AddressOptions & DeviceActionOptions,
  ): GetPublicKeyDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetPublicKeyCommand({ derivationPath, checkOnDevice }),
          appName: "NEAR",
          requiredUserInteraction: checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
        },
        inspect,
      }),
    });
  }
  signMessage(
    derivationPath: string,
    {
      inspect,
      ...taskArgs
    }: DeviceActionOptions & Omit<SignMessageTaskArgs, "derivationPath">,
  ): SignMessageDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignMessageDeviceAction({
        input: {
          args: { ...taskArgs, derivationPath },
        },
        inspect,
      }),
    });
  }
  signTransaction(
    derivationPath: string,
    {
      inspect,
      ...taskArgs
    }: Omit<SignTransactionTaskArgs, "derivationPath"> & DeviceActionOptions,
  ): SignTransactionDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: { args: { ...taskArgs, derivationPath } },
        inspect,
      }),
    });
  }
  signDelegate(
    derivationPath: string,
    {
      inspect,
      ...taskArgs
    }: Omit<SignDelegateTaskArgs, "derivationPath"> & DeviceActionOptions,
  ): SignDelegateDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignDelegateDeviceAction({
        input: { args: { ...taskArgs, derivationPath } },
        inspect,
      }),
    });
  }
}

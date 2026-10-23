import {
  CallTaskInAppDeviceAction,
  type CommandErrorResult,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type ExecuteDeviceActionReturnType,
  type InternalApi,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { of } from "rxjs";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type AddressFormat } from "@api/model/AddressOptions";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import {
  GetExtendedPublicKeyTask,
  validateExtendedPublicKeyPath,
} from "@internal/app-binder/task/GetExtendedPublicKeyTask";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

@injectable()
export class BtcLegacyAppBinder<ErrorCodes extends string> {
  constructor(
    @inject(btcLegacyTypes.Dmk) private readonly dmk: DeviceManagementKit,
    @inject(btcLegacyTypes.SessionId)
    private readonly sessionId: DeviceSessionId,
    @inject(btcLegacyTypes.Profile)
    private readonly profile: LegacyCoinProfile<ErrorCodes>,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
    addressFormat?: AddressFormat;
  }): GetAddressDAReturnType<ErrorCodes> {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new LegacyGetAddressCommand(args, this.profile.errors),
          appName: this.profile.appName,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getExtendedPublicKey(args: {
    derivationPath: string;
    skipOpenApp: boolean;
  }): GetExtendedPublicKeyDAReturnType<ErrorCodes> {
    const pathError = validateExtendedPublicKeyPath(args.derivationPath);
    if (pathError !== undefined) {
      return this.reject(pathError);
    }

    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi: InternalApi) =>
            new GetExtendedPublicKeyTask(internalApi, {
              derivationPath: args.derivationPath,
              profile: this.profile,
            }).run(),
          appName: this.profile.appName,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  // Fails without running a device action, so that invalid arguments are
  // rejected before the app is opened and the user is prompted.
  private reject<Output, IntermediateValue>(
    error: CommandErrorResult<ErrorCodes>["error"],
  ): ExecuteDeviceActionReturnType<
    Output,
    CommandErrorResult<ErrorCodes>["error"],
    IntermediateValue
  > {
    return {
      observable: of({ status: DeviceActionStatus.Error, error }),
      cancel: () => undefined,
    };
  }
}

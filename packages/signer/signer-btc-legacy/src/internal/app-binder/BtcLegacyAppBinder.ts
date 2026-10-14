import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressFormat } from "@api/model/AddressOptions";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
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
}

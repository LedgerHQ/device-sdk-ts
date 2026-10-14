import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { btcLegacyTypes } from "./btcLegacyTypes";
import { LegacyGetAddressCommand } from "./GetAddressCommand";
import { type GetAddressDAReturnType } from "./GetAddressDeviceActionTypes";
import { type LegacyCoinProfile } from "./profile";

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
    addressFormat?: number;
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

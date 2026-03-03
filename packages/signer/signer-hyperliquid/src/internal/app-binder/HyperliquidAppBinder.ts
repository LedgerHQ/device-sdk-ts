import type {
  DeviceManagementKit,
  DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type SignActionsDAReturnType } from "@api/app-binder/SignActionsDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { SignActionsDeviceAction } from "./device-action/SignActions/SignActionsDeviceAction";
import { HyperliquidAction } from "./utils/actionTlvSerializer";

@injectable()
export class HyperliquidAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  signActions(args: {
    derivationPath: string;
    certificate: Uint8Array;
    signedMetadata: Uint8Array;
    actions: HyperliquidAction[];
    skipOpenApp?: boolean;
  }): SignActionsDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignActionsDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          certificate: args.certificate,
          signedMetadata: args.signedMetadata,
          actions: args.actions,
          skipOpenApp: args.skipOpenApp ?? false,
        },
      }),
    });
  }
}

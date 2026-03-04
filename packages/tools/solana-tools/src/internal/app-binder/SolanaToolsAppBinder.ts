import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type CraftTransactionDAReturnType } from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { CraftTransactionDeviceAction } from "./device-action/CraftTransactionDeviceAction";
import { GenerateTransactionDeviceAction } from "./device-action/GenerateTransactionDeviceAction";

@injectable()
export class SolanaToolsAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  generateTransaction(args: {
    derivationPath: string;
    skipOpenApp: boolean;
  }): GenerateTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new GenerateTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  craftTransaction(args: {
    derivationPath: string;
    serialisedTransaction: string;
    skipOpenApp: boolean;
  }): CraftTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CraftTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          serialisedTransaction: args.serialisedTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}

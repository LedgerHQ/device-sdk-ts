import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type DeviceSessionId,
  LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { APP_NAME } from "@internal/app-binder/constants";
import { externalTypes } from "@internal/externalTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { SignTransactionTask } from "./task/SignTransactionTask";

@injectable()
export class PolkadotAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.DmkLoggerFactory)
    private dmkLoggerFactory: (tag: string) => LoggerPublisherService,
  ) {}

  getAddress(args: {
    derivationPath: string;
    ss58Prefix: number;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand(args),
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("GetAddressCommand"),
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    blob: Uint8Array;
    metadata: Uint8Array;
    skipOpenApp?: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SignTransactionTask(
              internalApi,
              args,
              this.dmkLoggerFactory("SignTransactionTask"),
            ).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
        logger: this.dmkLoggerFactory("SignTransactionCommand"),
      }),
    });
  }
}

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
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  GetAddressCommand,
  type GetAddressCommandArgs,
} from "@internal/app-binder/command/GetAddressCommand";
import { GetVersionCommand } from "@internal/app-binder/command/GetVersionCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class IcpAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.DmkLoggerFactory)
    private dmkLoggerFactory: (tag: string) => LoggerPublisherService,
  ) {}

  getVersion(args: { skipOpenApp: boolean }): GetVersionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetVersionCommand(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("GetVersionCommand"),
      }),
    });
  }

  getAddress(args: GetAddressCommandArgs): GetAddressDAReturnType {
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
    transaction: Uint8Array;
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

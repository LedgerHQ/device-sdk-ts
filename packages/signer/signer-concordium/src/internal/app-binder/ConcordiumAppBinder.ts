import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type DeviceSessionId,
  LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignCredentialDeploymentTransactionDAReturnType } from "@api/app-binder/SignCredentialDeploymentTransactionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  GetPublicKeyCommand,
  type GetPublicKeyCommandArgs,
} from "@internal/app-binder/command/GetPublicKeyCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendCredentialDeploymentTransactionTask } from "@internal/app-binder/task/SendCredentialDeploymentTransactionTask";
import { createSignTransactionTask } from "@internal/app-binder/task/SignTransactionTaskFactory";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class ConcordiumAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.DmkLoggerFactory)
    private dmkLoggerFactory: (tag: string) => LoggerPublisherService,
  ) {}

  getPublicKey(args: GetPublicKeyCommandArgs): GetPublicKeyDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetPublicKeyCommand(args),
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("GetPublicKeyCommand"),
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
            createSignTransactionTask(
              internalApi,
              args,
              this.dmkLoggerFactory,
            )(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
        logger: this.dmkLoggerFactory("SignTransaction"),
      }),
    });
  }

  signCredentialDeploymentTransaction(args: {
    derivationPath: string;
    transaction: Uint8Array;
    skipOpenApp?: boolean;
  }): SignCredentialDeploymentTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendCredentialDeploymentTransactionTask(
              internalApi,
              {
                derivationPath: args.derivationPath,
                transaction: args.transaction,
              },
              this.dmkLoggerFactory("SendCredentialDeploymentTransactionTask"),
            ).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp ?? false,
        },
        logger: this.dmkLoggerFactory("SignCredentialDeploymentTransaction"),
      }),
    });
  }
}

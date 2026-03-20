import {
  CallTaskInAppDeviceAction,
  DeviceManagementKit,
  type DeviceSessionId,
  LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { APP_NAME } from "./constants";
import {
  type DescriptorInput,
  ProvideTrustedDynamicDescriptorTask,
} from "./task/ProvideTrustedDynamicDescriptorTask";
import { GetAddressTask } from "./task/GetAddressTask";
import { GetVersionTask } from "./task/GetVersionTask";
import { SignPersonalMessageTask } from "./task/SignPersonalMessageTask";
import { SignTransactionTask } from "./task/SignTransactionTask";

@injectable()
export class SuiAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.DmkLoggerFactory)
    private dmkLoggerFactory: (tag: string) => LoggerPublisherService,
  ) {}

  getVersion(): GetVersionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new GetVersionTask(internalApi).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("GetVersionTask"),
      }),
    });
  }

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new GetAddressTask(internalApi, {
              derivationPath: args.derivationPath,
              checkOnDevice: args.checkOnDevice,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("GetAddressTask"),
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    transaction: Uint8Array;
    objectData?: Uint8Array[];
    descriptor?: DescriptorInput;
    skipOpenApp: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) => {
            // Provide trusted dynamic descriptor for clear signing if available
            if (args.descriptor) {
              const descriptorResult =
                await new ProvideTrustedDynamicDescriptorTask(internalApi, {
                  descriptor: args.descriptor,
                }).run();
              if ("error" in descriptorResult) {
                return descriptorResult;
              }
            }

            return new SignTransactionTask(internalApi, {
              derivationPath: args.derivationPath,
              transaction: args.transaction,
              objectData: args.objectData,
            }).run();
          },
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("SignTransactionTask"),
      }),
    });
  }

  signPersonalMessage(args: {
    derivationPath: string;
    message: Uint8Array;
    skipOpenApp: boolean;
  }): SignPersonalMessageDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SignPersonalMessageTask(internalApi, {
              derivationPath: args.derivationPath,
              message: args.message,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction:
            UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("SignPersonalMessageTask"),
      }),
    });
  }
}

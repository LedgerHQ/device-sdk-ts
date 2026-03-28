import { type ContextModule } from "@ledgerhq/context-module";
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
import { SignTransactionDeviceAction } from "./device-action/SignTransaction/SignTransactionDeviceAction";
import { GetAddressTask } from "./task/GetAddressTask";
import { GetVersionTask } from "./task/GetVersionTask";
import { type DescriptorInput } from "./task/ProvideTrustedDynamicDescriptorTask";
import { SignPersonalMessageTask } from "./task/SignPersonalMessageTask";

@injectable()
export class SuiAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.ContextModule)
    private contextModule: ContextModule,
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
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          transaction: args.transaction,
          objectData: args.objectData,
          descriptor: args.descriptor,
          contextModule: this.contextModule,
          skipOpenApp: args.skipOpenApp,
        },
        loggerFactory: this.dmkLoggerFactory,
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

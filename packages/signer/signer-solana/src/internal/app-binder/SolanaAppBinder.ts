import { type ContextModule } from "@ledgerhq/context-module";
import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignMessageVersion } from "@api/model/MessageOptions";
import { SolanaTransactionOptionalConfig } from "@api/model/SolanaTransactionOptionalConfig";
import { Transaction } from "@api/model/Transaction";
import { type SolanaSignerFeaturesNames } from "@internal/app-binder/SolanaApplicationResolver";
import { externalTypes } from "@internal/externalTypes";

import { GetAppConfigurationCommand } from "./command/GetAppConfigurationCommand";
import { GetAddressDeviceActionFactory } from "./device-action/GetAddressDeviceActionFactory";
import { SignMessageDeviceActionFactory } from "./device-action/SignMessageDeviceActionFactory";
import { SignTransactionDeviceAction } from "./device-action/SignTransactionDeviceAction";
import { appBinderTypes } from "./di/appBinderTypes";
import { BlockhashService } from "./services/BlockhashService";
import { APP_NAME } from "./constants";

@injectable()
export class SolanaAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.ContextModule) private contextModule: ContextModule,
    @inject(externalTypes.SolanaRPCURL)
    private solanaRPCURL: string | undefined,
    @inject(appBinderTypes.BlockhashService)
    private blockhashService: BlockhashService,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: GetAddressDeviceActionFactory({
        derivationPath: args.derivationPath,
        checkOnDevice: args.checkOnDevice,
        skipOpenApp: args.skipOpenApp,
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    transaction: Transaction;
    solanaTransactionOptionalConfig?: SolanaTransactionOptionalConfig;
    disabledFeatures?: ReadonlyArray<SolanaSignerFeaturesNames>;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          transaction: args.transaction,
          transactionOptions: args.solanaTransactionOptionalConfig,
          contextModule: this.contextModule,
          solanaRPCURL: this.solanaRPCURL,
          blockhashService: this.blockhashService,
          disabledFeatures: args.disabledFeatures,
        },
      }),
    });
  }

  signMessage(args: {
    derivationPath: string;
    message: string | Uint8Array;
    skipOpenApp: boolean;
    version?: SignMessageVersion;
    appDomain?: string;
    signers?: Uint8Array[];
  }): SignMessageDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: SignMessageDeviceActionFactory({
        derivationPath: args.derivationPath,
        message: args.message,
        skipOpenApp: args.skipOpenApp,
        version: args.version,
        appDomain: args.appDomain,
        signers: args.signers,
      }),
    });
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigurationCommand(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: false,
        },
      }),
    });
  }
}

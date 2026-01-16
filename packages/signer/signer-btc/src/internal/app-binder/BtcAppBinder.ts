import {
  CallTaskInAppDeviceAction,
  DeviceManagementKit,
  type DeviceSessionId,
  LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import {
  GetExtendedPublicKeyDAInput,
  GetExtendedPublicKeyDAReturnType,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import {
  GetMasterFingerprintDAInput,
  GetMasterFingerprintDAReturnType,
} from "@api/app-binder/GetMasterFingerprintDeviceActionTypes";
import {
  RegisterWalletDAInput,
  RegisterWalletDAReturnType,
} from "@api/app-binder/RegisterWalletDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { GetWalletAddressDAReturnType } from "@api/index";
import { Psbt } from "@api/model/Psbt";
import { Wallet } from "@api/model/Wallet";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
import { GetMasterFingerprintCommand } from "@internal/app-binder/command/GetMasterFingerprintCommand";
import { SignPsbtDeviceAction } from "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";
import { RegisterWalletTask } from "@internal/app-binder/task/RegisterWalletTask";
import { SendSignMessageTask } from "@internal/app-binder/task/SignMessageTask";
import { dataStoreTypes } from "@internal/data-store/di/dataStoreTypes";
import type { DataStoreService } from "@internal/data-store/service/DataStoreService";
import { externalTypes } from "@internal/externalTypes";
import { psbtTypes } from "@internal/psbt/di/psbtTypes";
import type { PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import type { ValueParser } from "@internal/psbt/service/value/ValueParser";
import { walletTypes } from "@internal/wallet/di/walletTypes";
import type { WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { GetWalletAddressDeviceAction } from "./device-action/GetWalletAddress/GetWalletAddressDeviceAction";

@injectable()
export class BtcAppBinder {
  constructor(
    @inject(externalTypes.Dmk)
    private readonly _dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId)
    private readonly _sessionId: DeviceSessionId,
    @inject(walletTypes.WalletBuilder)
    private readonly _walletBuilder: WalletBuilder,
    @inject(walletTypes.WalletSerializer)
    private readonly _walletSerializer: WalletSerializer,
    @inject(dataStoreTypes.DataStoreService)
    private readonly _dataStoreService: DataStoreService,
    @inject(psbtTypes.PsbtMapper)
    private readonly _psbtMapper: PsbtMapper,
    @inject(psbtTypes.ValueParser)
    private readonly _valueParser: ValueParser,
    @inject(externalTypes.DmkLoggerFactory)
    private readonly _dmkLoggerFactory: (tag: string) => LoggerPublisherService,
  ) {}

  getExtendedPublicKey(
    args: GetExtendedPublicKeyDAInput,
  ): GetExtendedPublicKeyDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetExtendedPublicKeyCommand(args),
          appName: "Bitcoin",
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this._dmkLoggerFactory("SendCommandInAppDeviceAction"),
      }),
    });
  }

  getMasterFingerprint(
    args: GetMasterFingerprintDAInput,
  ): GetMasterFingerprintDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetMasterFingerprintCommand(),
          appName: "Bitcoin",
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this._dmkLoggerFactory("SendCommandInAppDeviceAction"),
      }),
    });
  }

  signMessage(args: {
    derivationPath: string;
    message: string;
    skipOpenApp: boolean;
  }): SignMessageDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendSignMessageTask(
              internalApi,
              {
                derivationPath: args.derivationPath,
                message: args.message,
                loggerFactory: this._dmkLoggerFactory,
              },
              this._dataStoreService,
            ).run(),
          appName: "Bitcoin",
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this._dmkLoggerFactory("CallTaskInAppDeviceAction"),
      }),
    });
  }

  signPsbt(args: {
    psbt: Psbt;
    wallet: Wallet;
    skipOpenApp: boolean;
  }): SignPsbtDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignPsbtDeviceAction({
        input: {
          psbt: args.psbt,
          wallet: args.wallet,
          walletBuilder: this._walletBuilder,
          walletSerializer: this._walletSerializer,
          dataStoreService: this._dataStoreService,
          psbtMapper: this._psbtMapper,
          valueParser: this._valueParser,
          skipOpenApp: args.skipOpenApp,
        },
        loggerFactory: this._dmkLoggerFactory,
      }),
    });
  }

  getWalletAddress(args: {
    checkOnDevice: boolean;
    wallet: Wallet;
    change: boolean;
    addressIndex: number;
    skipOpenApp: boolean;
  }): GetWalletAddressDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new GetWalletAddressDeviceAction({
        input: {
          wallet: args.wallet,
          skipOpenApp: args.skipOpenApp,
          checkOnDevice: args.checkOnDevice,
          change: args.change,
          addressIndex: args.addressIndex,
          walletBuilder: this._walletBuilder,
          walletSerializer: this._walletSerializer,
          dataStoreService: this._dataStoreService,
        },
        loggerFactory: this._dmkLoggerFactory,
      }),
    });
  }

  signTransaction(args: {
    psbt: Psbt;
    wallet: Wallet;
    skipOpenApp: boolean;
  }): SignTransactionDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          psbt: args.psbt,
          wallet: args.wallet,
          walletBuilder: this._walletBuilder,
          walletSerializer: this._walletSerializer,
          dataStoreService: this._dataStoreService,
          psbtMapper: this._psbtMapper,
          valueParser: this._valueParser,
          skipOpenApp: args.skipOpenApp,
        },
        loggerFactory: this._dmkLoggerFactory,
      }),
    });
  }

  registerWallet(args: RegisterWalletDAInput): RegisterWalletDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new RegisterWalletTask(
              internalApi,
              {
                walletPolicy: args.wallet,
                loggerFactory: this._dmkLoggerFactory,
              },
              this._walletBuilder,
              this._walletSerializer,
              this._dataStoreService,
            ).run(),
          appName: "Bitcoin",
          requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this._dmkLoggerFactory("CallTaskInAppDeviceAction"),
      }),
    });
  }
}

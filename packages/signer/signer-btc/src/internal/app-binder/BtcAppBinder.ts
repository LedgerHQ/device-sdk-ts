import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import {
  GetExtendedPublicKeyDAInput,
  GetExtendedPublicKeyDAReturnType,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { Psbt } from "@api/model/Psbt";
import { Wallet } from "@api/model/Wallet";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
import { SignPsbtDeviceAction } from "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction";
import { dataStoreTypes } from "@internal/data-store/di/dataStoreTypes";
import type { DataStoreService } from "@internal/data-store/service/DataStoreService";
import { externalTypes } from "@internal/externalTypes";
import { psbtTypes } from "@internal/psbt/di/psbtTypes";
import type { PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import type { ValueParser } from "@internal/psbt/service/value/ValueParser";
import { walletTypes } from "@internal/wallet/di/walletTypes";
import type { WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { SignMessageDeviceAction } from "./device-action/SignMessage/SignMessageDeviceAction";

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
        },
      }),
    });
  }

  signMessage(args: {
    derivationPath: string;
    message: string;
  }): SignMessageDAReturnType {
    return this._dmk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignMessageDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          message: args.message,
          dataStoreService: this._dataStoreService,
        },
      }),
    });
  }

  signPsbt(args: { psbt: Psbt; wallet: Wallet }): SignPsbtDAReturnType {
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
        },
      }),
    });
  }
}

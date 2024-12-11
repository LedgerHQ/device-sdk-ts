import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type DefaultWallet } from "@api/model/Wallet";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
import { GetMasterFingerprintCommand } from "@internal/app-binder/command/GetMasterFingerprintCommand";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";

export class PrepareWalletPolicyTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _walletBuilder: WalletBuilder,
    private readonly _dataStoreService: DataStoreService,
  ) {}

  async run(defaultWallet: DefaultWallet): Promise<CommandResult<DataStore>> {
    // request master fingerprint
    const getMasterFingerPrintResult = await this._api.sendCommand(
      new GetMasterFingerprintCommand(),
    );
    if (!isSuccessCommandResult(getMasterFingerPrintResult)) {
      return getMasterFingerPrintResult;
    }

    // request extended public key for derivation path
    const getExtendedPublicKeyResult = await this._api.sendCommand(
      new GetExtendedPublicKeyCommand({
        derivationPath: defaultWallet.derivationPath,
        checkOnDevice: false,
      }),
    );
    if (!isSuccessCommandResult(getExtendedPublicKeyResult)) {
      return getExtendedPublicKeyResult;
    }
    // create default wallet with wallet policy service
    const wallet = this._walletBuilder.fromDefaultWallet(
      getMasterFingerPrintResult.data.masterFingerprint,
      getExtendedPublicKeyResult.data.extendedPublicKey,
      defaultWallet,
    );
    // feed the data store
    const store = new DataStore();
    this._dataStoreService.merklizeWallet(store, wallet);

    return CommandResultFactory({
      data: store,
    });
  }
}

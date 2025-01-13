import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  type DefaultWallet,
  type Wallet as ApiWallet,
} from "@api/model/Wallet";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
import { GetMasterFingerprintCommand } from "@internal/app-binder/command/GetMasterFingerprintCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";

export type PrepareWalletPolicyTaskArgs = { wallet: ApiWallet };

export class PrepareWalletPolicyTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: PrepareWalletPolicyTaskArgs,
    private readonly _walletBuilder: WalletBuilder,
  ) {}

  private isDefaultWallet(wallet: ApiWallet): wallet is DefaultWallet {
    return "derivationPath" in wallet;
  }

  async run() {
    const { wallet } = this._args;

    // Return build from a registered wallet
    if (!this.isDefaultWallet(wallet)) {
      return Promise.resolve(
        CommandResultFactory<InternalWallet, BtcErrorCodes>({
          data: this._walletBuilder.fromRegisteredWallet(wallet),
        }),
      );
    }
    // Get xpub and masterfingerprint for a default wallet
    const xPubKeyResult = await this._api.sendCommand(
      new GetExtendedPublicKeyCommand({
        checkOnDevice: false,
        derivationPath: wallet.derivationPath,
      }),
    );
    if (!isSuccessCommandResult(xPubKeyResult)) {
      return xPubKeyResult;
    }
    const masterFingerprintResult = await this._api.sendCommand(
      new GetMasterFingerprintCommand(),
    );
    if (!isSuccessCommandResult(masterFingerprintResult)) {
      return masterFingerprintResult;
    }
    // Return build from a default wallet
    return CommandResultFactory<InternalWallet, BtcErrorCodes>({
      data: this._walletBuilder.fromDefaultWallet(
        masterFingerprintResult.data.masterFingerprint,
        xPubKeyResult.data.extendedPublicKey,
        wallet,
      ),
    });
  }
}

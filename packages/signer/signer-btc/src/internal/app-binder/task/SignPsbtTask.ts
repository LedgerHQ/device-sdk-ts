import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

import { Psbt } from "@api/model/Psbt";
import { Wallet as ApiWallet } from "@api/model/Wallet";
import { SignPsbtCommand } from "@internal/app-binder/command/SignPsbtCommand";
import { BuildPsbtTask } from "@internal/app-binder/task/BuildPsbtTask";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { PrepareWalletPolicyTask } from "@internal/app-binder/task/PrepareWalletPolicyTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import { PsbtCommitment } from "@internal/data-store/service/DataStoreService";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type SignPsbtTaskArgs = {
  psbt: Psbt;
  wallet: ApiWallet;
};

@injectable()
export class SignPsbtTask {
  private readonly _walletSerializer: WalletSerializer;
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SignPsbtTaskArgs,
    walletSerializer?: WalletSerializer,
  ) {
    const hasher = new Sha256HasherService();
    this._walletSerializer =
      walletSerializer || new DefaultWalletSerializer(hasher);
  }

  private async runPrepareWalletPolicy() {
    return new PrepareWalletPolicyTask(this._api, {
      wallet: this._args.wallet,
    }).run();
  }
  private async runBuildPsbt(wallet: InternalWallet) {
    return new BuildPsbtTask({ wallet, psbt: this._args.psbt }).run();
  }

  private async runSignPsbt(
    psbtCommitment: PsbtCommitment,
    dataStore: DataStore,
    inputsCount: number,
    outputsCount: number,
    wallet: InternalWallet,
  ) {
    const signPsbtCommandResult = await this._api.sendCommand(
      new SignPsbtCommand({
        globalCommitments: psbtCommitment.globalCommitment,
        inputsCount,
        inputsCommitments: psbtCommitment.inputsRoot,
        outputsCount,
        outputsCommitments: psbtCommitment.outputsRoot,
        walletId: this._walletSerializer.getId(wallet),
        walletHmac: wallet.hmac,
      }),
    );

    const continueTask = new ContinueTask(this._api);
    const result = await continueTask.run(dataStore, signPsbtCommandResult);

    if (isSuccessCommandResult(result)) {
      return BtcCommandUtils.getSignature(result);
    }
    return result;
  }

  async run() {
    const walletResult = await this.runPrepareWalletPolicy();
    if (!isSuccessCommandResult(walletResult)) {
      return walletResult;
    }
    const psbtResult = await this.runBuildPsbt(walletResult.data);
    if (!isSuccessCommandResult(psbtResult)) {
      return psbtResult;
    }
    return await this.runSignPsbt(
      psbtResult.data.psbtCommitment,
      psbtResult.data.dataStore,
      psbtResult.data.inputsCount,
      psbtResult.data.outputsCount,
      walletResult.data,
    );
  }
}

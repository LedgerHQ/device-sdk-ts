import {
  ApduParser,
  ApduResponse,
  CommandResult,
  CommandResultFactory,
  CommandSuccessResult,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

import { Psbt } from "@api/model/Psbt";
import { Signature } from "@api/model/Signature";
import { Wallet as ApiWallet } from "@api/model/Wallet";
import { SignPsbtCommand } from "@internal/app-binder/command/SignPsbtCommand";
import { BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { BuildPsbtTask } from "@internal/app-binder/task/BuildPsbtTask";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { PrepareWalletPolicyTask } from "@internal/app-binder/task/PrepareWalletPolicyTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import { PsbtCommitment } from "@internal/data-store/service/DataStoreService";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type SignPsbtTaskArgs = {
  psbt: Psbt;
  wallet: ApiWallet;
};

const R_LENGTH = 32;
const S_LENGTH = 32;

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
    wallet: InternalWallet,
  ) {
    const signPsbtCommandResult = await this._api.sendCommand(
      new SignPsbtCommand({
        globalCommitments: psbtCommitment.globalCommitment,
        inputsCommitments: psbtCommitment.inputsRoot,
        outputsCommitments: psbtCommitment.outputsRoot,
        walletId: this._walletSerializer.getId(wallet),
        walletHmac: wallet.hmac,
      }),
    );

    console.log("SIGN PSBT BEFORE CONTINUE", signPsbtCommandResult);

    const continueTask = new ContinueTask(this._api);
    const result = await continueTask.run(dataStore, signPsbtCommandResult);

    console.log("SIGN PSBT SIG RESULT", result);
    if (isSuccessCommandResult(result)) {
      return this.parseSignature(result);
    }
    return CommandResultFactory<Signature, BitcoinAppErrorCodes>({
      error: new InvalidStatusWordError("Invalid response from the device"),
    });
  }

  async run() {
    console.log("RUN PREPARE WALLET POLICY", this._args);
    const walletResult = await this.runPrepareWalletPolicy();
    if (!isSuccessCommandResult(walletResult)) {
      return walletResult;
    }
    console.log("RUN BUILD PSBT", walletResult);
    const psbtResult = await this.runBuildPsbt(walletResult.data);
    if (!isSuccessCommandResult(psbtResult)) {
      return psbtResult;
    }
    console.log("RUN SIGN PSBT", psbtResult, walletResult);
    return await this.runSignPsbt(
      psbtResult.data.psbtCommitment,
      psbtResult.data.dataStore,
      walletResult.data,
    );
  }
  private parseSignature(
    result: CommandSuccessResult<ApduResponse>,
  ): CommandResult<Signature, BitcoinAppErrorCodes> {
    const parser = new ApduParser(result.data);

    const v = parser.extract8BitUInt();
    if (v === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("V is missing"),
      });
    }

    const r = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
      true,
    );
    if (!r) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("R is missing"),
      });
    }

    const s = parser.encodeToHexaString(
      parser.extractFieldByLength(S_LENGTH),
      true,
    );
    if (!s) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("S is missing"),
      });
    }

    return CommandResultFactory({
      data: {
        v,
        r,
        s,
      },
    });
  }
}

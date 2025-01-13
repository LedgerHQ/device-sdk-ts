import {
  ByteArrayParser,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { SignPsbtCommand } from "@internal/app-binder/command/SignPsbtCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type BuildPsbtTaskResult } from "@internal/app-binder/task/BuildPsbtTask";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { PsbtGlobal } from "@internal/psbt/model/Psbt";
import type { ValueParser } from "@internal/psbt/service/value/ValueParser";
import { extractVarint } from "@internal/utils/Varint";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type SignPsbtTaskArgs = BuildPsbtTaskResult & {
  wallet: InternalWallet;
};

export type PsbtSignature = {
  inputIndex: number;
  pubKeyAugmented: Uint8Array;
  signature: Uint8Array;
};

export type SignPsbtTaskResult = CommandResult<PsbtSignature[], BtcErrorCodes>;

export class SignPsbtTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SignPsbtTaskArgs,
    private readonly _walletSerializer: WalletSerializer,
    private readonly _valueParser: ValueParser,
    private readonly _continueTaskFactory = (
      api: InternalApi,
      dataStore: DataStore,
    ) => new ContinueTask(api, dataStore),
  ) {}

  async run(): Promise<SignPsbtTaskResult> {
    const {
      psbtCommitment: { globalCommitment, inputsRoot, outputsRoot },
      psbt,
      wallet,
      dataStore,
    } = this._args;
    const signPsbtCommandResult = await this._api.sendCommand(
      new SignPsbtCommand({
        globalCommitment,
        inputsRoot,
        outputsRoot,
        inputsCount: psbt
          .getGlobalValue(PsbtGlobal.INPUT_COUNT)
          .chain((value) => this._valueParser.getVarint(value.data))
          .orDefault(0),
        outputsCount: psbt
          .getGlobalValue(PsbtGlobal.OUTPUT_COUNT)
          .chain((value) => this._valueParser.getVarint(value.data))
          .orDefault(0),
        walletId: this._walletSerializer.getId(wallet),
        walletHmac: wallet.hmac,
      }),
    );

    const continueTask = this._continueTaskFactory(this._api, dataStore);
    const result = await continueTask.run(signPsbtCommandResult);

    if (isSuccessCommandResult(result)) {
      const signatureList = continueTask.getYieldedResults();
      const signatures = signatureList.map((sig) => {
        const parser = new ByteArrayParser(sig);
        const inputIndex = extractVarint(parser).mapOrDefault(
          (val) => val.value,
          0,
        );
        const pubKeyAugmentedLength = Maybe.fromNullable(
          parser.extract8BitUInt(),
        ).orDefault(0);
        const pubKeyAugmented = Maybe.fromNullable(
          parser.extractFieldByLength(pubKeyAugmentedLength),
        ).orDefault(Uint8Array.from([]));
        const signature = Maybe.fromNullable(
          parser.extractFieldByLength(parser.getUnparsedRemainingLength()),
        ).orDefault(Uint8Array.from([]));
        return { signature, inputIndex, pubKeyAugmented };
      });
      return CommandResultFactory({
        data: signatures,
      });
    }
    return result;
  }
}

import {
  bufferToHexaString,
  ByteArrayBuilder,
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type HexaString,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  isSuccessDmkResult,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { LegacyHashOutputFullCommand } from "@internal/app-binder/command/HashOutputFullCommand";
import { LegacyProvideOutputFullChangePathCommand } from "@internal/app-binder/command/ProvideOutputFullChangePathCommand";
import { LegacySignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { LegacyStartUntrustedHashTransactionInputCommand } from "@internal/app-binder/command/StartUntrustedHashTransactionInputCommand";
import {
  type SignedTransactionInput,
  type TransactionSerializer,
} from "@internal/app-binder/task/format/TransactionSerializer";
import { type GetTrustedInputTask } from "@internal/app-binder/task/GetTrustedInputTask";
import {
  compressPublicKey,
  createVarint,
  DEFAULT_LOCKTIME,
  DEFAULT_SEQUENCE,
  sequenceToBytes,
  SIGHASH_ALL,
  splitOutputBlocks,
  splitScriptBlocks,
} from "@internal/app-binder/task/utils/legacyTransactionUtils";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

// A trusted input starts with a 4-byte magic and nonce, then the prevout.
const TRUSTED_INPUT_PREVOUT_OFFSET = 4;
const PREVOUT_LENGTH = 36;
const TRUSTED_INPUT_MARKER = 0x01;

type SignTransactionTaskError<ErrorCodes extends string> =
  CommandErrorResult<ErrorCodes>["error"];

export type SignTransactionTaskResult<ErrorCodes extends string> = DmkResult<
  HexaString,
  SignTransactionTaskError<ErrorCodes>
>;

type SignedInput = {
  readonly trustedInput: Uint8Array;
  // The script signed for this input: the redeem script, or the script of
  // the output it spends.
  readonly script: Uint8Array;
  readonly sequence: Uint8Array;
};

// The builders silently drop an out-of-range number, and DataView wraps it.
const isUint = (value: number, max: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= max;

/**
 * Signs a transaction without SegWit inputs, as hw-app-btc's
 * `createTransaction` does: one trusted input per input, then, for each input,
 * the whole transaction hashed with that input's script only, and its
 * signature.
 */
@injectable()
export class SignTransactionTask<ErrorCodes extends string> {
  constructor(
    @inject(btcLegacyTypes.Profile)
    private readonly profile: LegacyCoinProfile<ErrorCodes>,
    @inject(btcLegacyTypes.GetTrustedInputTask)
    private readonly getTrustedInputTask: GetTrustedInputTask<ErrorCodes>,
    @inject(btcLegacyTypes.TransactionSerializer)
    private readonly serializer: TransactionSerializer,
  ) {}

  /**
   * Checks the arguments without the device. The app binder calls it before
   * opening the app, so that invalid arguments never prompt the user.
   */
  validate({
    inputs,
    associatedKeysets,
    outputScriptHex,
    lockTime,
    sigHashType,
  }: LegacyCreateTransactionArg): InvalidStatusWordError | undefined {
    if (inputs.length === 0) {
      return new InvalidStatusWordError("The transaction has no input");
    }

    if (inputs.length !== associatedKeysets.length) {
      return new InvalidStatusWordError(
        "Inputs and associatedKeysets lengths mismatch",
      );
    }

    const outputScript = hexaStringToBuffer(outputScriptHex);
    if (outputScript === null || outputScript.length === 0) {
      return new InvalidStatusWordError(
        "The output script is not a non-empty hexadecimal string",
      );
    }

    if (lockTime !== undefined && !isUint(lockTime, 0xffffffff)) {
      return new InvalidStatusWordError("The lock time is not a uint32");
    }

    if (sigHashType !== undefined && !isUint(sigHashType, 0xff)) {
      return new InvalidStatusWordError("The sighash type is not a uint8");
    }

    for (const [transaction, outputIndex, redeemScript, sequence] of inputs) {
      if (transaction.outputs?.[outputIndex] === undefined) {
        return new InvalidStatusWordError(
          "Invalid output index in previous transaction",
        );
      }

      if (
        typeof redeemScript === "string" &&
        hexaStringToBuffer(redeemScript) === null
      ) {
        return new InvalidStatusWordError(
          "The redeem script is not a hexadecimal string",
        );
      }

      if (typeof sequence === "number" && !isUint(sequence, 0xffffffff)) {
        return new InvalidStatusWordError("The sequence is not a uint32");
      }

      const error = this.getTrustedInputTask.validate(transaction);
      if (error !== undefined) {
        return error;
      }
    }

    return undefined;
  }

  async run(
    api: InternalApi,
    transaction: LegacyCreateTransactionArg,
  ): Promise<SignTransactionTaskResult<ErrorCodes>> {
    const error = this.validate(transaction);
    if (error !== undefined) {
      return DmkResultFactory({ error });
    }

    const {
      inputs,
      associatedKeysets,
      changePath,
      outputScriptHex,
      lockTime = DEFAULT_LOCKTIME,
      sigHashType = SIGHASH_ALL,
    } = transaction;
    const outputScript = hexaStringToBuffer(outputScriptHex)!;

    const signedInputs: SignedInput[] = [];
    for (const [
      previousTransaction,
      outputIndex,
      redeemScript,
      sequence,
    ] of inputs) {
      const trustedInput = await this.getTrustedInputTask.run(api, {
        transaction: previousTransaction,
        indexLookup: outputIndex,
      });
      if (!isSuccessDmkResult(trustedInput)) {
        return trustedInput;
      }

      signedInputs.push({
        trustedInput: trustedInput.data,
        script:
          typeof redeemScript === "string"
            ? hexaStringToBuffer(redeemScript)!
            : previousTransaction.outputs![outputIndex]!.script,
        sequence: sequenceToBytes(
          typeof sequence === "number" ? sequence : DEFAULT_SEQUENCE,
        ),
      });
    }

    const publicKeys: Uint8Array[] = [];
    for (const derivationPath of associatedKeysets) {
      const result = await api.sendCommand(
        new LegacyGetAddressCommand({ derivationPath }, this.profile.errors),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
      publicKeys.push(compressPublicKey(result.data.publicKey));
    }

    const signatures: Uint8Array[] = [];
    for (const [index, derivationPath] of associatedKeysets.entries()) {
      const hashError =
        (await this.hashInputs(api, signedInputs, index)) ??
        (await this.hashOutputs(api, outputScript, changePath));
      if (hashError !== undefined) {
        return DmkResultFactory({ error: hashError });
      }

      const signature = await api.sendCommand(
        new LegacySignTransactionCommand(
          { derivationPath, lockTime, sigHashType },
          this.profile.errors,
        ),
      );
      if (!isSuccessCommandResult(signature)) {
        return DmkResultFactory({ error: signature.error });
      }
      signatures.push(signature.data.signature);
    }

    const transactionInputs: SignedTransactionInput[] = signedInputs.map(
      ({ trustedInput, sequence }, index) => ({
        prevout: trustedInput.subarray(
          TRUSTED_INPUT_PREVOUT_OFFSET,
          TRUSTED_INPUT_PREVOUT_OFFSET + PREVOUT_LENGTH,
        ),
        script: new ByteArrayBuilder()
          .encodeInLVFromBuffer(signatures[index]!)
          .encodeInLVFromBuffer(publicKeys[index]!)
          .build(),
        sequence,
      }),
    );

    return DmkResultFactory({
      data: bufferToHexaString(
        this.serializer.serializeSignedTransaction({
          inputs: transactionInputs,
          outputScript,
          lockTime,
        }),
      ),
    });
  }

  // Streams every input, only the one being signed carrying its script. The
  // first stream starts a new transaction, the next ones continue it.
  private async hashInputs(
    api: InternalApi,
    signedInputs: SignedInput[],
    signedIndex: number,
  ): Promise<SignTransactionTaskError<ErrorCodes> | undefined> {
    const newTransaction = signedIndex === 0;
    const chunks: Uint8Array[] = [];

    signedInputs.forEach(({ trustedInput, script, sequence }, index) => {
      const inputScript = index === signedIndex ? script : new Uint8Array();
      chunks.push(
        new ByteArrayBuilder()
          .add8BitUIntToData(TRUSTED_INPUT_MARKER)
          .encodeInLVFromBuffer(trustedInput)
          .addBufferToData(createVarint(inputScript.length))
          .build(),
        ...splitScriptBlocks(inputScript, sequence),
      );
    });

    const header = await api.sendCommand(
      new LegacyStartUntrustedHashTransactionInputCommand(
        {
          newTransaction,
          firstRound: true,
          transactionData: this.serializer.serializeHeader(signedInputs.length),
        },
        this.profile.errors,
      ),
    );
    if (!isSuccessCommandResult(header)) {
      return header.error;
    }

    for (const transactionData of chunks) {
      const result = await api.sendCommand(
        new LegacyStartUntrustedHashTransactionInputCommand(
          { newTransaction, firstRound: false, transactionData },
          this.profile.errors,
        ),
      );
      if (!isSuccessCommandResult(result)) {
        return result.error;
      }
    }

    return undefined;
  }

  private async hashOutputs(
    api: InternalApi,
    outputScript: Uint8Array,
    changePath: string | undefined,
  ): Promise<SignTransactionTaskError<ErrorCodes> | undefined> {
    if (changePath) {
      const result = await api.sendCommand(
        new LegacyProvideOutputFullChangePathCommand(
          { derivationPath: changePath },
          this.profile.errors,
        ),
      );
      if (!isSuccessCommandResult(result)) {
        return result.error;
      }
    }

    const blocks = splitOutputBlocks(outputScript);
    for (const [index, outputChunk] of blocks.entries()) {
      const result = await api.sendCommand(
        new LegacyHashOutputFullCommand(
          { outputChunk, isLastChunk: index === blocks.length - 1 },
          this.profile.errors,
        ),
      );
      if (!isSuccessCommandResult(result)) {
        return result.error;
      }
    }

    return undefined;
  }
}

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
  TRANSACTION_TYPE,
  type TransactionType,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
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
  hashPublicKey,
  p2pkhScript,
  p2wpkhScript,
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
const WITNESS_ITEM_COUNT = 0x02;

type SignTransactionTaskError<ErrorCodes extends string> =
  CommandErrorResult<ErrorCodes>["error"];

export type SignTransactionTaskResult<ErrorCodes extends string> = DmkResult<
  HexaString,
  SignTransactionTaskError<ErrorCodes>
>;

type SignedInput = {
  readonly trustedInput: Uint8Array;
  // The script signed for this input: the redeem script, the P2PKH script of
  // its key for SegWit, or the script of the output it spends.
  readonly script: Uint8Array;
  readonly sequence: Uint8Array;
};

// The builders silently drop an out-of-range number, and DataView wraps it.
const isUint = (value: number, max: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= max;

/**
 * Signs a transaction as hw-app-btc's `createTransaction` does: one trusted
 * input per input, then
 * - without BIP143, for each input, the whole transaction hashed with that
 *   input's script only, and its signature;
 * - with BIP143, the whole transaction hashed once, then each input alone and
 *   its signature.
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
      segwit = false,
      additionals = [],
    } = transaction;
    const outputScript = hexaStringToBuffer(outputScriptHex)!;
    const bip143 = segwit;
    const bech32 = segwit && additionals.includes("bech32");

    const trustedInputs: Uint8Array[] = [];
    for (const [previousTransaction, outputIndex] of inputs) {
      const trustedInput = await this.getTrustedInputTask.run(api, {
        transaction: previousTransaction,
        indexLookup: outputIndex,
      });
      if (!isSuccessDmkResult(trustedInput)) {
        return trustedInput;
      }
      trustedInputs.push(trustedInput.data);
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

    const signedInputs: SignedInput[] = inputs.map(
      ([previousTransaction, outputIndex, redeemScript, sequence], index) => ({
        trustedInput: trustedInputs[index]!,
        script:
          typeof redeemScript === "string"
            ? hexaStringToBuffer(redeemScript)!
            : segwit
              ? p2pkhScript(hashPublicKey(publicKeys[index]!))
              : previousTransaction.outputs![outputIndex]!.script,
        sequence: sequenceToBytes(
          typeof sequence === "number" ? sequence : DEFAULT_SEQUENCE,
        ),
      }),
    );
    const withoutScript = (input: SignedInput): SignedInput => ({
      ...input,
      script: new Uint8Array(),
    });

    if (bip143) {
      const hashError =
        (await this.hashInputs(
          api,
          signedInputs.map(withoutScript),
          TRANSACTION_TYPE.BIP143,
        )) ?? (await this.hashOutputs(api, outputScript, changePath));
      if (hashError !== undefined) {
        return DmkResultFactory({ error: hashError });
      }
    }

    const signatures: Uint8Array[] = [];
    for (const [index, derivationPath] of associatedKeysets.entries()) {
      const hashError = bip143
        ? await this.hashInputs(api, [signedInputs[index]!])
        : ((await this.hashInputs(
            api,
            signedInputs.map((input, inputIndex) =>
              inputIndex === index ? input : withoutScript(input),
            ),
            index === 0 ? TRANSACTION_TYPE.LEGACY : undefined,
          )) ?? (await this.hashOutputs(api, outputScript, changePath)));
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
        script: this.inputScript(
          segwit,
          bech32,
          signatures[index]!,
          publicKeys[index]!,
        ),
        sequence,
      }),
    );

    return DmkResultFactory({
      data: bufferToHexaString(
        this.serializer.serializeSignedTransaction({
          inputs: transactionInputs,
          outputScript,
          lockTime,
          witnesses: segwit
            ? signatures.map((signature, index) =>
                new ByteArrayBuilder()
                  .add8BitUIntToData(WITNESS_ITEM_COUNT)
                  .encodeInLVFromBuffer(signature)
                  .encodeInLVFromBuffer(publicKeys[index]!)
                  .build(),
              )
            : undefined,
        }),
      ),
    });
  }

  // A SegWit input's signature is in its witness: a native input has no
  // script, a P2SH-wrapped one pushes its witness program.
  private inputScript(
    segwit: boolean,
    bech32: boolean,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): Uint8Array {
    if (bech32) {
      return new Uint8Array();
    }

    const builder = new ByteArrayBuilder();
    return segwit
      ? builder
          .encodeInLVFromBuffer(p2wpkhScript(hashPublicKey(publicKey)))
          .build()
      : builder
          .encodeInLVFromBuffer(signature)
          .encodeInLVFromBuffer(publicKey)
          .build();
  }

  // Streams the inputs with their scripts. With a transaction type, the
  // stream starts a new transaction of that type, otherwise it continues one.
  private async hashInputs(
    api: InternalApi,
    signedInputs: SignedInput[],
    transactionType?: TransactionType,
  ): Promise<SignTransactionTaskError<ErrorCodes> | undefined> {
    const newTransaction = transactionType !== undefined;
    const chunks: Uint8Array[] = [];

    signedInputs.forEach(({ trustedInput, script, sequence }) => {
      chunks.push(
        new ByteArrayBuilder()
          .add8BitUIntToData(TRUSTED_INPUT_MARKER)
          .encodeInLVFromBuffer(trustedInput)
          .addBufferToData(createVarint(script.length))
          .build(),
        ...splitScriptBlocks(script, sequence),
      );
    });

    const header = await api.sendCommand(
      new LegacyStartUntrustedHashTransactionInputCommand(
        {
          newTransaction,
          firstRound: true,
          transactionData: this.serializer.serializeHeader(signedInputs.length),
          transactionType,
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
          {
            newTransaction,
            firstRound: false,
            transactionData,
            transactionType,
          },
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

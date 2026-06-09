import {
  bufferToHexaString,
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

import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { HashOutputFullCommand } from "@internal/app-binder/command/HashOutputFullCommand";
import { ProvideOutputFullChangePathCommand } from "@internal/app-binder/command/ProvideOutputFullChangePathCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { StartUntrustedHashTransactionInputCommand } from "@internal/app-binder/command/StartUntrustedHashTransactionInputCommand";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { ZcashSaplingOutputCommitCommand } from "@internal/app-binder/command/ZcashSaplingOutputCommitCommand";
import { GetTrustedInputTask } from "@internal/app-binder/task/GetTrustedInputTask";
import {
  buildP2pkhScriptPubKeyFromLedgerZcashPublicKey,
  compressPublicKey,
  createVarint,
  DEFAULT_LOCKTIME,
  DEFAULT_SEQUENCE,
  getZcashBranchId,
  getZcashDefaultTransactionVersion,
  type InternalTransaction,
  type InternalTransactionInput,
  type InternalTransactionOutput,
  MAX_SCRIPT_BLOCK,
  parseOutputScriptsFromPaymentOutputBlob,
  resolveExpiryHeightBytes,
  serializeTransaction,
  SIGHASH_ALL,
  toInternalTransaction,
} from "@internal/app-binder/task/utils/legacyTransactionUtils";
import { areBytesEqual } from "@internal/utils/areBytesEqual";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";
import { uint32ToBytesLE } from "@internal/utils/numberToBytes";

type SignTransactionTaskArgs = {
  transactionArg: LegacyCreateTransactionArg;
};
type SignTransactionTaskError = CommandErrorResult<ZcashErrorCodes>["error"];
type SignTransactionTaskResult = DmkResult<
  HexaString,
  SignTransactionTaskError
>;

type TrustedInputEntry = {
  trustedInput: boolean;
  value: Uint8Array;
  sequence: Uint8Array;
};

type CollectInputsResult = {
  trustedInputs: TrustedInputEntry[];
  regularOutputs: InternalTransactionOutput[];
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<SignTransactionTaskResult> {
    const defaults = {
      lockTime: DEFAULT_LOCKTIME,
      sigHashType: SIGHASH_ALL,
      additionals: [] as string[],
    };
    const signTx = { ...defaults, ...this.args.transactionArg };
    const {
      inputs,
      associatedKeysets,
      blockHeight,
      changePath,
      outputScriptHex,
      lockTime,
      sigHashType,
      additionals: additionalsRaw,
      expiryHeight,
    } = signTx;
    const additionals = new Set(
      additionalsRaw.map((item) => item.trim().toLowerCase()),
    );
    if (!additionals.has("zcash")) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          'signTransaction requires additionals to include "zcash" (Zcash transparent signing only).',
        ),
      });
    }
    const sapling = additionals.has("sapling");

    if (inputs.length !== associatedKeysets.length) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "Inputs and associatedKeysets lengths mismatch",
        ),
      });
    }

    const lockTimeBytes = uint32ToBytesLE(lockTime);
    const defaultVersion = getZcashDefaultTransactionVersion();
    // Ledger Wallet always passes expiry for v5 txs (often zero); required for BIP143 flow.
    let expiryHeightBytes: Uint8Array;
    try {
      expiryHeightBytes = resolveExpiryHeightBytes(expiryHeight);
    } catch (error) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          error instanceof Error ? error.message : "Invalid expiryHeight",
        ),
      });
    }

    const outputScript =
      hexaStringToBuffer(outputScriptHex) ?? new Uint8Array();
    const nullPrevout = new Uint8Array(0);
    const targetTransaction: InternalTransaction = {
      inputs: [],
      version: defaultVersion,
      timestamp: new Uint8Array(0),
    };
    // These fields are constant across all inputs — set once before processing.
    targetTransaction.nVersionGroupId = Uint8Array.of(0x0a, 0x27, 0xa7, 0x26);
    targetTransaction.nExpiryHeight = expiryHeightBytes;
    targetTransaction.extraData = sapling
      ? new Uint8Array(11)
      : Uint8Array.of(0x00);

    const inputsResult = await this.collectTrustedInputsAndOutputs(inputs);
    if (!("trustedInputs" in inputsResult)) {
      return inputsResult;
    }
    const { trustedInputs, regularOutputs } = inputsResult;

    targetTransaction.inputs = inputs.map((input, idx) => {
      const sequence = uint32ToBytesLE(
        input.length >= 4 && typeof input[3] === "number"
          ? input[3]
          : DEFAULT_SEQUENCE,
      );
      return {
        script: regularOutputs[idx]!.script,
        prevout: nullPrevout,
        sequence,
      };
    });

    const publicKeysResult = await this.collectPublicKeys(associatedKeysets);
    if (!Array.isArray(publicKeysResult)) {
      return publicKeysResult;
    }
    const publicKeys = publicKeysResult;

    const provideChangeResult = await this.shouldProvideChangePath(
      changePath,
      associatedKeysets,
      publicKeys,
      outputScript,
    );
    if (typeof provideChangeResult !== "boolean") {
      return provideChangeResult;
    }

    targetTransaction.consensusBranchId = getZcashBranchId(blockHeight);

    const hashError = await this.executeHashSequence(
      targetTransaction,
      trustedInputs,
      changePath,
      provideChangeResult,
      outputScript,
      sapling,
      lockTime,
      sigHashType,
      expiryHeightBytes,
    );
    if (hashError) {
      return hashError;
    }

    const signaturesResult = await this.signEachInput(
      inputs,
      associatedKeysets,
      regularOutputs,
      targetTransaction,
      trustedInputs,
      lockTime,
      sigHashType,
      expiryHeightBytes,
    );
    if (!Array.isArray(signaturesResult)) {
      return signaturesResult;
    }
    const signatures = signaturesResult;

    targetTransaction.version = defaultVersion;
    targetTransaction.consensusBranchId = getZcashBranchId(blockHeight);
    for (let i = 0; i < inputs.length; i += 1) {
      targetTransaction.inputs[i]!.script = concatUint8Arrays(
        Uint8Array.of(signatures[i]!.length),
        signatures[i]!,
        Uint8Array.of(publicKeys[i]!.length),
        publicKeys[i]!,
      );
      const offset = 4;
      targetTransaction.inputs[i]!.prevout = trustedInputs[i]!.value.subarray(
        offset,
        offset + 0x24,
      );
    }

    targetTransaction.locktime = lockTimeBytes;
    const result = concatUint8Arrays(
      serializeTransaction(targetTransaction, targetTransaction.timestamp),
      outputScript,
      Uint8Array.of(0x00, 0x00, 0x00),
    );

    return DmkResultFactory({
      data: bufferToHexaString(result, true),
    });
  }

  private async collectTrustedInputsAndOutputs(
    inputs: LegacyCreateTransactionArg["inputs"],
  ): Promise<CollectInputsResult | SignTransactionTaskResult> {
    const trustedInputs: TrustedInputEntry[] = [];
    const regularOutputs: InternalTransactionOutput[] = [];

    for (const input of inputs) {
      const legacyPrevious = input[0];
      const previousTx = toInternalTransaction(legacyPrevious);
      previousTx.consensusBranchId = getZcashBranchId(input[4]);
      const trustedInputResult = await this.getTrustedInput(
        input[1],
        previousTx,
        legacyPrevious.serializedPreviousTransactionOverride,
      );
      if (typeof trustedInputResult !== "string") {
        return trustedInputResult;
      }

      const sequence = uint32ToBytesLE(
        input.length >= 4 && typeof input[3] === "number"
          ? input[3]
          : DEFAULT_SEQUENCE,
      );
      trustedInputs.push({
        trustedInput: true,
        value: hexaStringToBuffer(trustedInputResult) ?? new Uint8Array(),
        sequence,
      });

      if (previousTx.outputs && input[1] <= previousTx.outputs.length - 1) {
        const referencedOutput = previousTx.outputs[input[1]];
        if (!referencedOutput) {
          return DmkResultFactory({
            error: new InvalidStatusWordError(
              "Invalid output index in previous transaction",
            ),
          });
        }
        regularOutputs.push(referencedOutput);
      } else {
        return DmkResultFactory({
          error: new InvalidStatusWordError(
            "Invalid output index in previous transaction",
          ),
        });
      }
    }

    return { trustedInputs, regularOutputs };
  }

  private async collectPublicKeys(
    associatedKeysets: string[],
  ): Promise<Uint8Array[] | SignTransactionTaskResult> {
    const publicKeys: Uint8Array[] = [];

    for (const derivationPath of associatedKeysets) {
      const pubKeyResult = await this.api.sendCommand(
        new GetAddressCommand({
          derivationPath,
          checkOnDevice: false,
        }),
      );
      if (!isSuccessCommandResult(pubKeyResult)) {
        return DmkResultFactory({ error: pubKeyResult.error });
      }
      publicKeys.push(compressPublicKey(pubKeyResult.data.publicKey));
    }

    return publicKeys;
  }

  private async shouldProvideChangePath(
    changePath: string | undefined,
    associatedKeysets: string[],
    publicKeys: Uint8Array[],
    outputScript: Uint8Array,
  ): Promise<boolean | SignTransactionTaskResult> {
    const changePathTrimmed =
      typeof changePath === "string" ? changePath.trim() : "";
    if (changePathTrimmed === "") {
      return false;
    }

    const reuseIdx = associatedKeysets.indexOf(changePathTrimmed);
    let ledgerPubForChange: Uint8Array;
    if (reuseIdx >= 0) {
      ledgerPubForChange = publicKeys[reuseIdx]!;
    } else {
      const changeAddrResult = await this.api.sendCommand(
        new GetAddressCommand({
          derivationPath: changePathTrimmed,
          checkOnDevice: false,
        }),
      );
      if (!isSuccessCommandResult(changeAddrResult)) {
        return DmkResultFactory({ error: changeAddrResult.error });
      }
      ledgerPubForChange = changeAddrResult.data.publicKey;
    }

    try {
      const expectedChangeScript =
        buildP2pkhScriptPubKeyFromLedgerZcashPublicKey(ledgerPubForChange);
      const outputScripts =
        parseOutputScriptsFromPaymentOutputBlob(outputScript);
      /** Multi-output with change: send change-path APDU. Single-output: omit (6986). */
      return (
        outputScripts !== null &&
        outputScripts.length >= 2 &&
        outputScripts.some((s) => areBytesEqual(s, expectedChangeScript))
      );
    } catch {
      return false;
    }
  }

  private async executeHashSequence(
    targetTransaction: InternalTransaction,
    trustedInputs: TrustedInputEntry[],
    changePath: string | undefined,
    provideChangePath: boolean,
    outputScript: Uint8Array,
    sapling: boolean,
    lockTime: number,
    sigHashType: number,
    expiryHeightBytes: Uint8Array,
  ): Promise<SignTransactionTaskResult | null> {
    const globalHashInputResult = await this.startUntrustedHashTransactionInput(
      true,
      targetTransaction,
      trustedInputs,
    );
    if (globalHashInputResult) {
      return globalHashInputResult;
    }

    if (provideChangePath && changePath) {
      const changePathResult = await this.api.sendCommand(
        new ProvideOutputFullChangePathCommand({
          derivationPath: changePath,
        }),
      );
      if (!isSuccessCommandResult(changePathResult)) {
        return DmkResultFactory({ error: changePathResult.error });
      }
    }

    const globalOutputHashResult = await this.hashOutputFull(outputScript);
    if (globalOutputHashResult) {
      return globalOutputHashResult;
    }

    if (sapling) {
      const saplingCommitResult = await this.api.sendCommand(
        new ZcashSaplingOutputCommitCommand({
          lockTime,
          sigHashType,
          expiryHeight: expiryHeightBytes,
        }),
      );
      if (!isSuccessCommandResult(saplingCommitResult)) {
        return DmkResultFactory({ error: saplingCommitResult.error });
      }
    }

    return null;
  }

  private async signEachInput(
    inputs: LegacyCreateTransactionArg["inputs"],
    associatedKeysets: string[],
    regularOutputs: InternalTransactionOutput[],
    targetTransaction: InternalTransaction,
    trustedInputs: TrustedInputEntry[],
    lockTime: number,
    sigHashType: number,
    expiryHeightBytes: Uint8Array,
  ): Promise<Uint8Array[] | SignTransactionTaskResult> {
    const signatures: Uint8Array[] = [];

    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i]!;
      const script =
        input.length >= 3 && typeof input[2] === "string"
          ? (hexaStringToBuffer(input[2]) ?? new Uint8Array())
          : regularOutputs[i]!.script;

      const pseudoTransaction: InternalTransaction = {
        ...targetTransaction,
        inputs: [{ ...targetTransaction.inputs[i]!, script }],
      };

      const hashInputResult = await this.startUntrustedHashTransactionInput(
        false,
        pseudoTransaction,
        [trustedInputs[i]!],
      );
      if (hashInputResult) {
        return hashInputResult;
      }

      const signatureResult = await this.api.sendCommand(
        new SignTransactionCommand({
          derivationPath: associatedKeysets[i]!,
          lockTime,
          sigHashType,
          expiryHeight: expiryHeightBytes,
        }),
      );
      if (!isSuccessCommandResult(signatureResult)) {
        return DmkResultFactory({ error: signatureResult.error });
      }
      signatures.push(signatureResult.data.signature);
    }

    return signatures;
  }

  private async getTrustedInput(
    indexLookup: number,
    transaction: InternalTransaction,
    serializedPreviousTransactionOverride?: Uint8Array,
  ): Promise<string | SignTransactionTaskResult> {
    const serializedTransaction =
      serializedPreviousTransactionOverride &&
      serializedPreviousTransactionOverride.length > 0
        ? serializedPreviousTransactionOverride
        : serializeTransaction(transaction, transaction.timestamp);
    const trustedInputResult = await new GetTrustedInputTask(this.api, {
      transaction: serializedTransaction,
      indexLookup,
    }).run();
    if (!isSuccessDmkResult(trustedInputResult)) {
      return DmkResultFactory({ error: trustedInputResult.error });
    }
    return bufferToHexaString(trustedInputResult.data.data, false);
  }

  private async hashOutputFull(
    outputScript: Uint8Array,
  ): Promise<SignTransactionTaskResult | null> {
    let offset = 0;
    while (offset < outputScript.length) {
      const blockSize =
        offset + MAX_SCRIPT_BLOCK >= outputScript.length
          ? outputScript.length - offset
          : MAX_SCRIPT_BLOCK;
      const chunk = outputScript.subarray(offset, offset + blockSize);
      const result = await this.api.sendCommand(
        new HashOutputFullCommand({
          outputChunk: chunk,
          isLastChunk: offset + blockSize === outputScript.length,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
      offset += blockSize;
    }
    return null;
  }

  private buildScriptBlocks(input: InternalTransactionInput): Uint8Array[] {
    if (input.script.length === 0) {
      return [input.sequence];
    }
    const blocks: Uint8Array[] = [];
    let offset = 0;
    while (offset !== input.script.length) {
      const blockSize = Math.min(
        MAX_SCRIPT_BLOCK,
        input.script.length - offset,
      );
      const chunk = input.script.subarray(offset, offset + blockSize);
      blocks.push(
        offset + blockSize === input.script.length
          ? concatUint8Arrays(chunk, input.sequence)
          : Uint8Array.from(chunk),
      );
      offset += blockSize;
    }
    return blocks;
  }

  private async sendInputBlocks(
    blocks: Uint8Array[],
    newTransaction: boolean,
  ): Promise<SignTransactionTaskResult | null> {
    for (const block of blocks) {
      const result = await this.api.sendCommand(
        new StartUntrustedHashTransactionInputCommand({
          newTransaction,
          firstRound: false,
          transactionData: block,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
    }
    return null;
  }

  private async startUntrustedHashTransactionInput(
    newTransaction: boolean,
    transaction: InternalTransaction,
    trustedInputs: TrustedInputEntry[],
  ): Promise<SignTransactionTaskResult | null> {
    const zCashConsensusBranchId =
      transaction.consensusBranchId || new Uint8Array(0);
    const header = concatUint8Arrays(
      transaction.version,
      transaction.timestamp || new Uint8Array(0),
      transaction.nVersionGroupId || new Uint8Array(0),
      zCashConsensusBranchId,
      createVarint(transaction.inputs.length),
    );

    const firstHeaderResult = await this.api.sendCommand(
      new StartUntrustedHashTransactionInputCommand({
        newTransaction,
        firstRound: true,
        transactionData: header,
      }),
    );
    if (!isSuccessCommandResult(firstHeaderResult)) {
      return DmkResultFactory({ error: firstHeaderResult.error });
    }

    for (let index = 0; index < transaction.inputs.length; index += 1) {
      const input = transaction.inputs[index]!;
      const inputValue = trustedInputs[index]!.value;
      const prefix = trustedInputs[index]!.trustedInput
        ? Uint8Array.of(0x01, inputValue.length)
        : Uint8Array.of(0x00);

      const inputHeader = concatUint8Arrays(
        prefix,
        inputValue,
        createVarint(input.script.length),
      );
      const inputHeaderResult = await this.api.sendCommand(
        new StartUntrustedHashTransactionInputCommand({
          newTransaction,
          firstRound: false,
          transactionData: inputHeader,
        }),
      );
      if (!isSuccessCommandResult(inputHeaderResult)) {
        return DmkResultFactory({ error: inputHeaderResult.error });
      }

      const sendBlocksError = await this.sendInputBlocks(
        this.buildScriptBlocks(input),
        newTransaction,
      );
      if (sendBlocksError) {
        return sendBlocksError;
      }
    }

    return null;
  }
}

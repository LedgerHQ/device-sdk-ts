import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type HexaString,
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
  value: Buffer;
  sequence: Buffer;
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

    const lockTimeBuffer = Buffer.alloc(4);
    lockTimeBuffer.writeUInt32LE(lockTime, 0);
    const defaultVersion = getZcashDefaultTransactionVersion();
    // Ledger Wallet always passes expiry for v5 txs (often zero); required for BIP143 flow.
    let expiryHeightBuffer: Buffer;
    try {
      expiryHeightBuffer = resolveExpiryHeightBytes(expiryHeight);
    } catch (error) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          error instanceof Error ? error.message : "Invalid expiryHeight",
        ),
      });
    }

    const outputScript = Buffer.from(outputScriptHex, "hex");
    const nullPrevout = Buffer.alloc(0);
    const targetTransaction: InternalTransaction = {
      inputs: [],
      version: defaultVersion,
      timestamp: Buffer.alloc(0),
    };
    // These fields are constant across all inputs — set once before processing.
    targetTransaction.nVersionGroupId = Buffer.from([0x0a, 0x27, 0xa7, 0x26]);
    targetTransaction.nExpiryHeight = expiryHeightBuffer;
    targetTransaction.extraData = sapling
      ? Buffer.from([
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ])
      : Buffer.from([0x00]);

    const inputsResult = await this.collectTrustedInputsAndOutputs(inputs);
    if (!("trustedInputs" in inputsResult)) {
      return inputsResult;
    }
    const { trustedInputs, regularOutputs } = inputsResult;

    targetTransaction.inputs = inputs.map((input, idx) => {
      const sequence = Buffer.alloc(4);
      sequence.writeUInt32LE(
        input.length >= 4 && typeof input[3] === "number"
          ? input[3]
          : DEFAULT_SEQUENCE,
        0,
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
      expiryHeightBuffer,
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
      expiryHeightBuffer,
    );
    if (!Array.isArray(signaturesResult)) {
      return signaturesResult;
    }
    const signatures = signaturesResult;

    targetTransaction.version = defaultVersion;
    targetTransaction.consensusBranchId = getZcashBranchId(blockHeight);
    for (let i = 0; i < inputs.length; i += 1) {
      targetTransaction.inputs[i]!.script = Buffer.concat([
        Buffer.from([signatures[i]!.length]),
        signatures[i]!,
        Buffer.from([publicKeys[i]!.length]),
        publicKeys[i]!,
      ]);
      const offset = 4;
      targetTransaction.inputs[i]!.prevout = trustedInputs[i]!.value.subarray(
        offset,
        offset + 0x24,
      );
    }

    targetTransaction.locktime = lockTimeBuffer;
    let result = Buffer.concat([
      serializeTransaction(targetTransaction, targetTransaction.timestamp),
      outputScript,
    ]);
    result = Buffer.concat([result, Buffer.from([0x00, 0x00, 0x00])]);

    return DmkResultFactory({
      data: `0x${result.toString("hex")}` as HexaString,
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

      const sequence = Buffer.alloc(4);
      sequence.writeUInt32LE(
        input.length >= 4 && typeof input[3] === "number"
          ? input[3]
          : DEFAULT_SEQUENCE,
        0,
      );
      trustedInputs.push({
        trustedInput: true,
        value: Buffer.from(trustedInputResult, "hex"),
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
  ): Promise<Buffer[] | SignTransactionTaskResult> {
    const publicKeys: Buffer[] = [];

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
      publicKeys.push(
        compressPublicKey(Buffer.from(pubKeyResult.data.publicKey)),
      );
    }

    return publicKeys;
  }

  private async shouldProvideChangePath(
    changePath: string | undefined,
    associatedKeysets: string[],
    publicKeys: Buffer[],
    outputScript: Buffer,
  ): Promise<boolean | SignTransactionTaskResult> {
    const changePathTrimmed =
      typeof changePath === "string" ? changePath.trim() : "";
    if (changePathTrimmed === "") {
      return false;
    }

    const reuseIdx = associatedKeysets.indexOf(changePathTrimmed);
    let ledgerPubForChange: Buffer;
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
      ledgerPubForChange = Buffer.from(changeAddrResult.data.publicKey);
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
        outputScripts.some((s) => s.equals(expectedChangeScript))
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
    outputScript: Buffer,
    sapling: boolean,
    lockTime: number,
    sigHashType: number,
    expiryHeightBuffer: Buffer,
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
          expiryHeight: expiryHeightBuffer,
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
    expiryHeightBuffer: Buffer,
  ): Promise<Buffer[] | SignTransactionTaskResult> {
    const signatures: Buffer[] = [];

    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i]!;
      const script =
        input.length >= 3 && typeof input[2] === "string"
          ? Buffer.from(input[2], "hex")
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
          expiryHeight: expiryHeightBuffer,
        }),
      );
      if (!isSuccessCommandResult(signatureResult)) {
        return DmkResultFactory({ error: signatureResult.error });
      }
      signatures.push(Buffer.from(signatureResult.data.signature));
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
        ? Buffer.from(serializedPreviousTransactionOverride)
        : serializeTransaction(transaction, transaction.timestamp);
    const trustedInputResult = await new GetTrustedInputTask(this.api, {
      transaction: new Uint8Array(serializedTransaction),
      indexLookup,
    }).run();
    if (!isSuccessDmkResult(trustedInputResult)) {
      return DmkResultFactory({ error: trustedInputResult.error });
    }
    return Buffer.from(trustedInputResult.data.data).toString("hex");
  }

  private async hashOutputFull(
    outputScript: Buffer,
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
          outputChunk: new Uint8Array(chunk),
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

  private buildScriptBlocks(input: InternalTransactionInput): Buffer[] {
    if (input.script.length === 0) {
      return [input.sequence];
    }
    const blocks: Buffer[] = [];
    let offset = 0;
    while (offset !== input.script.length) {
      const blockSize = Math.min(
        MAX_SCRIPT_BLOCK,
        input.script.length - offset,
      );
      const chunk = input.script.subarray(offset, offset + blockSize);
      blocks.push(
        offset + blockSize === input.script.length
          ? Buffer.concat([chunk, input.sequence])
          : Buffer.from(chunk),
      );
      offset += blockSize;
    }
    return blocks;
  }

  private async sendInputBlocks(
    blocks: Buffer[],
    newTransaction: boolean,
  ): Promise<SignTransactionTaskResult | null> {
    for (const block of blocks) {
      const result = await this.api.sendCommand(
        new StartUntrustedHashTransactionInputCommand({
          newTransaction,
          firstRound: false,
          transactionData: new Uint8Array(block),
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
      transaction.consensusBranchId || Buffer.alloc(0);
    const header = Buffer.concat([
      transaction.version,
      transaction.timestamp || Buffer.alloc(0),
      transaction.nVersionGroupId || Buffer.alloc(0),
      zCashConsensusBranchId,
      createVarint(transaction.inputs.length),
    ]);

    const firstHeaderResult = await this.api.sendCommand(
      new StartUntrustedHashTransactionInputCommand({
        newTransaction,
        firstRound: true,
        transactionData: new Uint8Array(header),
      }),
    );
    if (!isSuccessCommandResult(firstHeaderResult)) {
      return DmkResultFactory({ error: firstHeaderResult.error });
    }

    for (let index = 0; index < transaction.inputs.length; index += 1) {
      const input = transaction.inputs[index]!;
      const inputValue = trustedInputs[index]!.value;
      const prefix = trustedInputs[index]!.trustedInput
        ? Buffer.from([0x01, inputValue.length])
        : Buffer.from([0x00]);

      const inputHeader = Buffer.concat([
        prefix,
        inputValue,
        createVarint(input.script.length),
      ]);
      const inputHeaderResult = await this.api.sendCommand(
        new StartUntrustedHashTransactionInputCommand({
          newTransaction,
          firstRound: false,
          transactionData: new Uint8Array(inputHeader),
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

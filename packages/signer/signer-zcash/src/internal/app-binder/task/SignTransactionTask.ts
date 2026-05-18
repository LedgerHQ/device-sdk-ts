import {
  type CommandResult,
  CommandResultFactory,
  type HexaString,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
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
  type InternalTransactionOutput,
  MAX_SCRIPT_BLOCK,
  parseOutputScriptsFromPaymentOutputBlob,
  serializeTransaction,
  SIGHASH_ALL,
  toInternalTransaction,
} from "@internal/app-binder/task/utils/legacyTransactionUtils";

type SignTransactionTaskArgs = {
  transactionArg: LegacyCreateTransactionArg;
};
type SignTransactionTaskError = CommandErrorResult<ZcashErrorCodes>["error"];
type SignTransactionTaskResult = DmkResult<Signature, SignTransactionTaskError>;

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<HexaString, ZcashErrorCodes>> {
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
    const additionals = additionalsRaw.map((item) => item.trim().toLowerCase());
    if (!additionals.includes("zcash")) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          'signTransaction requires additionals to include "zcash" (Zcash transparent signing only).',
        ),
      });
    }
    const sapling = additionals.includes("sapling");

    if (inputs.length !== associatedKeysets.length) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Inputs and associatedKeysets lengths mismatch",
        ),
      });
    }

    const lockTimeBuffer = Buffer.alloc(4);
    lockTimeBuffer.writeUInt32LE(lockTime, 0);
    const defaultVersion = getZcashDefaultTransactionVersion();
    // Ledger Wallet always passes expiry for v5 txs (often zero); required for BIP143 flow.
    const expiryHeightBuffer =
      expiryHeight !== undefined
        ? Buffer.from(expiryHeight)
        : Buffer.alloc(4, 0);

    const trustedInputs: Array<{
      trustedInput: boolean;
      value: Buffer;
      sequence: Buffer;
    }> = [];
    const regularOutputs: InternalTransactionOutput[] = [];
    const signatures: Buffer[] = [];
    const publicKeys: Buffer[] = [];
    let provideChangePathBeforeOutputs = false;
    const nullPrevout = Buffer.alloc(0);
    const targetTransaction: InternalTransaction = {
      inputs: [],
      version: defaultVersion,
      timestamp: Buffer.alloc(0),
    };
    const outputScript = Buffer.from(outputScriptHex, "hex");

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
          return CommandResultFactory({
            error: new InvalidStatusWordError(
              "Invalid output index in previous transaction",
            ),
          });
        }
        regularOutputs.push(referencedOutput);
      } else {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Invalid output index in previous transaction",
          ),
        });
      }

      targetTransaction.nVersionGroupId = Buffer.from([0x0a, 0x27, 0xa7, 0x26]);
      targetTransaction.nExpiryHeight = expiryHeightBuffer;
      targetTransaction.extraData = sapling
        ? Buffer.from([
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ])
        : Buffer.from([0x00]);
    }

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

    for (let i = 0; i < inputs.length; i += 1) {
      const pubKeyResult = await this.api.sendCommand(
        new GetAddressCommand({
          derivationPath: associatedKeysets[i]!,
          checkOnDevice: false,
        }),
      );
      if (!isSuccessCommandResult(pubKeyResult)) {
        return pubKeyResult;
      }

      publicKeys.push(
        compressPublicKey(Buffer.from(pubKeyResult.data.publicKey)),
      );
    }

    const changePathTrimmed =
      typeof changePath === "string" ? changePath.trim() : "";
    if (changePathTrimmed !== "") {
      const reuseIdx = associatedKeysets.findIndex(
        (p) => p === changePathTrimmed,
      );
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
          return changeAddrResult;
        }
        ledgerPubForChange = Buffer.from(changeAddrResult.data.publicKey);
      }
      try {
        const expectedChangeScript =
          buildP2pkhScriptPubKeyFromLedgerZcashPublicKey(ledgerPubForChange);
        const outputScripts =
          parseOutputScriptsFromPaymentOutputBlob(outputScript);
        /** Multi-output with change: send change-path APDU. Single-output: omit (6986). */
        provideChangePathBeforeOutputs =
          outputScripts !== null &&
          outputScripts.length >= 2 &&
          outputScripts.some((s) => s.equals(expectedChangeScript));
      } catch {
        provideChangePathBeforeOutputs = false;
      }
    }

    targetTransaction.consensusBranchId = getZcashBranchId(blockHeight);

    const globalHashInputResult = await this.startUntrustedHashTransactionInput(
      true,
      targetTransaction,
      trustedInputs,
    );
    if (globalHashInputResult) {
      return globalHashInputResult;
    }

    if (provideChangePathBeforeOutputs && changePath) {
      const changePathResult = await this.api.sendCommand(
        new ProvideOutputFullChangePathCommand({
          derivationPath: changePath,
        }),
      );
      if (!isSuccessCommandResult(changePathResult)) {
        return changePathResult;
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
        return saplingCommitResult;
      }
    }

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
      const pseudoTrustedInputs = [trustedInputs[i]!];

      const hashInputResult = await this.startUntrustedHashTransactionInput(
        false,
        pseudoTransaction,
        pseudoTrustedInputs,
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
          additionals,
        }),
      );
      if (!isSuccessCommandResult(signatureResult)) {
        return signatureResult;
      }
      signatures.push(Buffer.from(signatureResult.data.signature));
    }

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

    return CommandResultFactory({
      data: `0x${result.toString("hex")}` as HexaString,
    });
  }

  private async getTrustedInput(
    indexLookup: number,
    transaction: InternalTransaction,
    serializedPreviousTransactionOverride?: Uint8Array,
  ): Promise<string | CommandResult<HexaString, ZcashErrorCodes>> {
    const serializedTransaction =
      serializedPreviousTransactionOverride &&
      serializedPreviousTransactionOverride.length > 0
        ? Buffer.from(serializedPreviousTransactionOverride)
        : serializeTransaction(transaction, transaction.timestamp);
    const trustedInputResult = await new GetTrustedInputTask(this.api, {
      transaction: new Uint8Array(serializedTransaction),
      indexLookup,
    }).run();
    if (!isSuccessCommandResult(trustedInputResult)) {
      return trustedInputResult as CommandResult<HexaString, ZcashErrorCodes>;
    }
    return Buffer.from(trustedInputResult.data.data).toString("hex");
  }

  private async hashOutputFull(
    outputScript: Buffer,
  ): Promise<CommandResult<HexaString, ZcashErrorCodes> | null> {
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
        return result as CommandResult<HexaString, ZcashErrorCodes>;
      }
      offset += blockSize;
    }
    return null;
  }

  private async startUntrustedHashTransactionInput(
    newTransaction: boolean,
    transaction: InternalTransaction,
    trustedInputs: Array<{
      trustedInput: boolean;
      value: Buffer;
      sequence: Buffer;
    }>,
  ): Promise<CommandResult<HexaString, ZcashErrorCodes> | null> {
    const zCashConsensusBranchId =
      transaction.consensusBranchId || Buffer.alloc(0);
    let header = Buffer.concat([
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
      return firstHeaderResult as CommandResult<HexaString, ZcashErrorCodes>;
    }

    for (let index = 0; index < transaction.inputs.length; index += 1) {
      const input = transaction.inputs[index]!;
      const inputValue = trustedInputs[index]!.value;
      const prefix = trustedInputs[index]!.trustedInput
        ? Buffer.from([0x01, inputValue.length])
        : Buffer.from([0x00]);

      header = Buffer.concat([
        prefix,
        inputValue,
        createVarint(input.script.length),
      ]);
      const inputHeaderResult = await this.api.sendCommand(
        new StartUntrustedHashTransactionInputCommand({
          newTransaction,
          firstRound: false,
          transactionData: new Uint8Array(header),
        }),
      );
      if (!isSuccessCommandResult(inputHeaderResult)) {
        return inputHeaderResult as CommandResult<HexaString, ZcashErrorCodes>;
      }

      const scriptBlocks: Buffer[] = [];
      if (input.script.length === 0) {
        scriptBlocks.push(input.sequence);
      } else {
        let offset = 0;
        while (offset !== input.script.length) {
          const blockSize =
            input.script.length - offset > MAX_SCRIPT_BLOCK
              ? MAX_SCRIPT_BLOCK
              : input.script.length - offset;
          const chunk = input.script.subarray(offset, offset + blockSize);
          scriptBlocks.push(
            offset + blockSize !== input.script.length
              ? Buffer.from(chunk)
              : Buffer.concat([chunk, input.sequence]),
          );
          offset += blockSize;
        }
      }

      for (const block of scriptBlocks) {
        const scriptBlockResult = await this.api.sendCommand(
          new StartUntrustedHashTransactionInputCommand({
            newTransaction,
            firstRound: false,
            transactionData: new Uint8Array(block),
          }),
        );
        if (!isSuccessCommandResult(scriptBlockResult)) {
          return scriptBlockResult as CommandResult<
            HexaString,
            ZcashErrorCodes
          >;
        }
      }
    }

    return null;
  }
}

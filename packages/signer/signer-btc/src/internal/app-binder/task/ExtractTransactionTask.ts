import {
  bufferToHexaString,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type HexaString,
} from "@ledgerhq/device-management-kit";

import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import {
  type Psbt,
  PsbtGlobal,
  PsbtIn,
  PsbtOut,
} from "@internal/psbt/model/Psbt";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { encodeVarint } from "@internal/utils/Varint";

type ExtractTransactionTaskArgs = {
  psbt: Psbt;
};

export class ExtractTransactionTask {
  constructor(
    private readonly _args: ExtractTransactionTaskArgs,
    private readonly _valueParser: ValueParser,
  ) {}

  /**
   * Processes a PSBT (Partially Signed Bitcoin Transaction) and constructs a finalized Bitcoin transaction.
   *
   * @return {CommandResult<HexaString, BtcErrorCodes>} A `CommandResult` object containing the resulting serialized transaction
   *         as a hexadecimal string (without the "0x" prefix) on success, or an error code (`BtcErrorCodes`) on failure.
   */
  run(): CommandResult<HexaString, BtcErrorCodes> {
    const { psbt } = this._args;
    const transaction = new ByteArrayBuilder();
    const psbtVersion = psbt
      .getGlobalValue(PsbtGlobal.VERSION)
      .chain((value) => this._valueParser.getUInt32LE(value.data))
      .orDefault(0);
    transaction.add32BitUIntToData(psbtVersion, false);
    const isSegwit = psbt.getInputValue(0, PsbtIn.WITNESS_UTXO).isJust();
    if (isSegwit) {
      transaction.addBufferToData(Uint8Array.from([0, 0x01]));
    }
    const inputCount = psbt
      .getGlobalValue(PsbtGlobal.INPUT_COUNT)
      .chain((value) => this._valueParser.getVarint(value.data))
      .orDefault(0);

    transaction.addBufferToData(encodeVarint(inputCount).extract()!);
    const witnessBuffer = new ByteArrayBuilder();
    for (let i = 0; i < inputCount; i++) {
      transaction.addBufferToData(
        psbt
          .getInputValue(i, PsbtIn.PREVIOUS_TXID)
          .mapOrDefault((v) => v.data, Buffer.from([])),
      );
      const outputIndex = psbt
        .getInputValue(i, PsbtIn.OUTPUT_INDEX)
        .chain((value) => this._valueParser.getUInt32LE(value.data))
        .orDefault(0);
      transaction.add32BitUIntToData(outputIndex, false);
      const scriptSig = psbt
        .getInputValue(i, PsbtIn.FINAL_SCRIPTSIG)
        .mapOrDefault((v) => v.data, Uint8Array.from([]));
      transaction.addBufferToData(encodeVarint(scriptSig.length).extract()!);
      transaction.addBufferToData(scriptSig);
      const sequence = psbt
        .getInputValue(i, PsbtIn.SEQUENCE)
        .chain((value) => this._valueParser.getUInt32LE(value.data))
        .orDefault(0);
      transaction.add32BitUIntToData(sequence, false);
      if (isSegwit) {
        const witness = psbt
          .getInputValue(i, PsbtIn.FINAL_SCRIPTWITNESS)
          .mapOrDefault((v) => v.data, Uint8Array.from([]));
        witnessBuffer.addBufferToData(witness);
      }
    }
    const outputCount = psbt
      .getGlobalValue(PsbtGlobal.OUTPUT_COUNT)
      .chain((value) => this._valueParser.getVarint(value.data))
      .orDefault(0);
    transaction.addBufferToData(encodeVarint(outputCount).extract()!);
    for (let o = 0; o < outputCount; o++) {
      const amount = psbt
        .getOutputValue(o, PsbtOut.AMOUNT)
        .chain((value) => this._valueParser.getInt64LE(value.data))
        .orDefault(0n);
      const script = psbt
        .getOutputValue(o, PsbtOut.SCRIPT)
        .mapOrDefault((v) => v.data, Buffer.from([]));
      transaction.add64BitIntToData(amount, false);
      transaction.addBufferToData(encodeVarint(script.length).extract()!);
      transaction.addBufferToData(script);
    }
    transaction.addBufferToData(witnessBuffer.build());
    const locktime = psbt
      .getGlobalValue(PsbtGlobal.FALLBACK_LOCKTIME)
      .chain((v) => this._valueParser.getUInt32LE(v.data))
      .orDefault(0);
    transaction.add32BitUIntToData(locktime, false);
    return CommandResultFactory({
      data: bufferToHexaString(transaction.build()),
    });
  }
}

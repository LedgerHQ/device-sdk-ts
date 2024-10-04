import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { Transaction } from "bitcoinjs-lib";
import { inject, injectable } from "inversify";
import { Either, Just, Left, Maybe, Right } from "purify-ts";

import { psbtTypes } from "@internal/psbt/di/psbtTypes";
import { Key } from "@internal/psbt/model/Key";
import { Psbt } from "@internal/psbt/model/Psbt";
import { PsbtGlobal, PsbtIn, PsbtOut } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { type ValueFactory } from "@internal/psbt/service/value/ValueFactory";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";

/**
 * Normalize a PSBTv2 from any input PSBT, according to specification:
 * https://github.com/bitcoin/bips/blob/master/bip-0370.mediawiki
 */
@injectable()
export class DefaultPsbtV2Normalizer {
  constructor(
    @inject(psbtTypes.ValueParser) private valueParser: ValueParser,
    @inject(psbtTypes.ValueFactory) private valueFactory: ValueFactory,
  ) {}

  normalize(psbt: Psbt): Either<Error, Psbt> {
    // Get current PSBT version
    const version = psbt
      .getGlobalValue(PsbtGlobal.VERSION)
      .chain((value) => this.valueParser.getInt32LE(value.data))
      .orDefault(0);
    if (version === 2) {
      return Right(psbt);
    } else if (version !== 0) {
      return Left(new Error("PSBT normalizer: unsupported PSBT version"));
    }

    // Get the unsigned transaction to extract its metadata
    const transaction = psbt
      .getGlobalValue(PsbtGlobal.UNSIGNED_TX)
      .toEither(
        new Error("PSBT normalizer: PSBTv0 should contain a transaction"),
      )
      .chain((value) =>
        Either.encase(() =>
          Transaction.fromHex(bufferToHexaString(value.data).slice(2)),
        ).mapLeft(
          (error) =>
            new Error(
              `PSBT normalizer: failed to parse transaction (${error})`,
            ),
        ),
      );
    if (transaction.isLeft()) {
      return transaction;
    }
    const tx = transaction.unsafeCoerce();

    // Update global map with transaction metadata
    const globalMetadata: [PsbtGlobal, Maybe<Value>][] = [
      [PsbtGlobal.VERSION, this.valueFactory.fromInt32LE(2)],
      [PsbtGlobal.TX_VERSION, this.valueFactory.fromInt32LE(tx.version)],
      [
        PsbtGlobal.FALLBACK_LOCKTIME,
        this.valueFactory.fromUInt32LE(tx.locktime),
      ],
      [PsbtGlobal.INPUT_COUNT, this.valueFactory.fromVarint(tx.ins.length)],
      [PsbtGlobal.OUTPUT_COUNT, this.valueFactory.fromVarint(tx.outs.length)],
    ];
    let result = globalMetadata.reduce((success, [key, maybeValue]) => {
      maybeValue.ifJust((value) => psbt.setGlobalValue(key, value));
      return success && maybeValue.isJust();
    }, true);

    // Update inputs metadata
    for (let i = 0; i < tx.ins.length; i++) {
      const inputMetadata: [PsbtIn, Maybe<Value>][] = [
        [PsbtIn.PREVIOUS_TXID, Just(new Value(tx.ins[i]!.hash))],
        [PsbtIn.OUTPUT_INDEX, this.valueFactory.fromUInt32LE(tx.ins[i]!.index)],
        [PsbtIn.SEQUENCE, this.valueFactory.fromUInt32LE(tx.ins[i]!.sequence)],
      ];
      result = inputMetadata.reduce((success, [key, maybeValue]) => {
        maybeValue.ifJust((value) => psbt.setInputValue(i, key, value));
        return success && maybeValue.isJust();
      }, result);
    }

    // Update outputs metadata
    for (let i = 0; i < tx.outs.length; i++) {
      const outputMetadata: [PsbtOut, Maybe<Value>][] = [
        [PsbtOut.AMOUNT, this.valueFactory.fromInt64LE(tx.outs[i]!.value)],
        [PsbtOut.SCRIPT, Just(new Value(tx.outs[i]!.script))],
      ];
      result = outputMetadata.reduce((success, [key, maybeValue]) => {
        maybeValue.ifJust((value) => psbt.setOutputValue(i, key, value));
        return success && maybeValue.isJust();
      }, result);
    }

    // Remove UNSIGNED_TX from the transaction since it's deprecated in V2
    psbt.globalMap.delete(new Key(PsbtGlobal.UNSIGNED_TX).toHexaString());
    return result
      ? Right(psbt)
      : Left(new Error("PSBT normalizer: failed to update the ¨PSBT"));
  }
}

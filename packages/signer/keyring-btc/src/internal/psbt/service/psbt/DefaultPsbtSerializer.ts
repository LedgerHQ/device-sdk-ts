import {
  bufferToHexaString,
  ByteArrayBuilder,
  ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "bitcoinjs-lib";
import { inject } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";

import { psbtTypes } from "@internal/psbt/di/psbtTypes";
import { Key } from "@internal/psbt/model/Key";
import { Psbt } from "@internal/psbt/model/Psbt";
import { PsbtGlobal } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { type KeyPairSerializer } from "@internal/psbt/service/key-pair/KeyPairSerializer";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";

import { type PsbtSerializer } from "./PsbtSerializer";

// PSBT magic bytes
const PSBT_MAGIC_BYTES = Uint8Array.from([0x70, 0x73, 0x62, 0x74, 0xff]);

/**
 * According to specification, psbt is formatted as:
 * <magic> <global-map> <input-map>* <output-map>*
 * with:
 *   <magic>: 0x70 0x73 0x62 0x74 0xFF
 *   <map>: <keypair>* 0x00
 * For <keypair> serialization, it's done in KeyPair class.
 * For more informations:
 * https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#specification
 */
export class DefaultPsbtSerializer implements PsbtSerializer {
  constructor(
    @inject(psbtTypes.ValueParser)
    private readonly valueParser: ValueParser,
    @inject(psbtTypes.KeyPairSerializer)
    private readonly keyPairSerializer: KeyPairSerializer,
  ) {}

  private getValue(map: Map<string, Value>, keyType: number): Maybe<Value> {
    return Maybe.fromNullable(map.get(new Key(keyType).toHexaString()));
  }

  private sortMap(map: Map<string, Value>): Map<string, Value> {
    return new Map(
      Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    );
  }

  deserialize(buffer: Uint8Array): Either<Error, Psbt> {
    const parser = new ByteArrayParser(buffer);

    // Read PSBT magic
    for (const magicByte of PSBT_MAGIC_BYTES) {
      if (parser.extract8BitUInt() !== magicByte) {
        return Left(new Error("PSBT deserializer: Invalid magic bytes"));
      }
    }

    // Read all the maps available in that PSBT
    const maps: Map<string, Value>[] = [];
    while (parser.getUnparsedRemainingLength()) {
      maps.push(this.keyPairSerializer.deserializeMap(parser));
    }
    if (maps.length === 0) {
      return Left(new Error("PSBT deserializer: No map found"));
    }

    // Get global map
    const globalMap = maps[0]!;

    // Get inputs and outpus count, either from the global map, or within the tx
    const transaction = this.getValue(globalMap, PsbtGlobal.UNSIGNED_TX).chain(
      (value) =>
        Either.encase(() =>
          Transaction.fromHex(bufferToHexaString(value.data).slice(2)),
        ).toMaybe(),
    );
    const inputCount = this.getValue(globalMap, PsbtGlobal.INPUT_COUNT)
      .chain((value) => this.valueParser.getVarint(value.data))
      .alt(transaction.map((tx) => tx.ins.length));
    const outputCount = this.getValue(globalMap, PsbtGlobal.OUTPUT_COUNT)
      .chain((value) => this.valueParser.getVarint(value.data))
      .alt(transaction.map((tx) => tx.outs.length));

    // Get inputs map and outputs map
    if (inputCount.isJust() && outputCount.isJust()) {
      if (maps.length === 1 + inputCount.extract() + outputCount.extract()) {
        const inputMaps = maps.slice(1, 1 + inputCount.extract());
        const outputMaps = maps.slice(1 + inputCount.extract());
        return Right(new Psbt(globalMap, inputMaps, outputMaps));
      }
      return Left(
        new Error(
          "PSBT deserializer: map count don't match input and output count",
        ),
      );
    }
    return Left(
      new Error(
        "PSBT deserializer: input or output count not found in global map or transaction",
      ),
    );
  }

  serialize(psbt: Psbt): Uint8Array {
    const builder = new ByteArrayBuilder();

    // Start by ordering all the maps, in case some values were added
    psbt.globalMap = this.sortMap(psbt.globalMap);
    psbt.inputMaps = psbt.inputMaps.map((input) => this.sortMap(input));
    psbt.outputMaps = psbt.outputMaps.map((output) => this.sortMap(output));

    // Serialize PSBT magic
    builder.addBufferToData(PSBT_MAGIC_BYTES);

    // Serialize all the maps
    this.keyPairSerializer.serializeMap(builder, psbt.globalMap);
    psbt.inputMaps.forEach((input) =>
      this.keyPairSerializer.serializeMap(builder, input),
    );
    psbt.outputMaps.forEach((output) =>
      this.keyPairSerializer.serializeMap(builder, output),
    );

    return builder.build();
  }
}

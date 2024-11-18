import {
  ByteArrayBuilder,
  ByteArrayParser,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { inject } from "inversify";
import { Maybe } from "purify-ts";

import { psbtTypes } from "@internal/psbt/di/psbtTypes";
import { Key } from "@internal/psbt/model/Key";
import { KeyPair } from "@internal/psbt/model/KeyPair";
import { Value } from "@internal/psbt/model/Value";
import { type KeySerializer } from "@internal/psbt/service/key/KeySerializer";
import { encodeVarint, extractVarint } from "@internal/utils/Varint";

import { KeyPairSerializer } from "./KeyPairSerializer";

export class DefaultKeyPairSerializer implements KeyPairSerializer {
  constructor(
    @inject(psbtTypes.KeySerializer)
    private keySerializer: KeySerializer,
  ) {}

  /**
   * Deserialize a buffer into a KeyPair and return Maybe<KeyPair>
   *
   * @param parser ByteArrayParser
   * @returns Maybe<KeyPair>
   */
  deserialize(parser: ByteArrayParser): Maybe<KeyPair> {
    return (
      // Parse key
      this.keySerializer.deserialize(parser).chain((key) =>
        // Parse valueLen
        extractVarint(parser).chain((valueLen) =>
          // Parse value
          Maybe.fromNullable(parser.extractFieldByLength(valueLen.value)).map(
            (value) => new KeyPair(key, new Value(value)),
          ),
        ),
      )
    );
  }

  /**
   * Serialize a KeyPair into a buffer
   *
   * @param builder ByteArrayBuilder
   * @param keyPair KeyPair
   */
  serialize(builder: ByteArrayBuilder, keyPair: KeyPair) {
    encodeVarint(keyPair.value.data.length).ifJust((valueLen) => {
      this.keySerializer.serialize(builder, keyPair.key);
      builder.addBufferToData(valueLen);
      builder.addBufferToData(keyPair.value.data);
    });
  }

  /**
   * Deserialize a buffer into a map of string to Value
   *
   * @param parser ByteArrayParser
   * @returns Map<string, Value>
   */
  deserializeMap(parser: ByteArrayParser): Map<string, Value> {
    const map: Map<string, Value> = new Map();
    while (
      this.deserialize(parser)
        .ifJust((keyPair) => map.set(keyPair.key.toHexaString(), keyPair.value))
        .isJust()
    );
    return map;
  }

  /**
   * Serialize a map of string to Value into a buffer
   *
   * @param builder ByteArrayBuilder
   * @param map  Map<string, Value>
   */
  serializeMap(builder: ByteArrayBuilder, map: Map<string, Value>) {
    for (const [keyStr, value] of [...map]) {
      const keyBuf = hexaStringToBuffer(keyStr)!;
      const key = new Key(keyBuf[0]!, keyBuf.slice(1));
      const keyPair = new KeyPair(key, value);
      this.serialize(builder, keyPair);
    }
    // 0x00 should be serialized after each map
    builder.add8BitUIntToData(0);
  }
}

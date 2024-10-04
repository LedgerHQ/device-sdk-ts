import {
  ByteArrayBuilder,
  ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { Key } from "@internal/psbt/model/Key";
import { encodeVarint, extractVarint } from "@internal/utils/Varint";

import { KeySerializer } from "./KeySerializer";

export class DefaultKeySerializer implements KeySerializer {
  deserialize(parser: ByteArrayParser): Maybe<Key> {
    return (
      // Parse keyLen
      extractVarint(parser)
        .filter((keyLen) => keyLen.value > 0)
        .chain((keyLen) =>
          // Parse keyType
          extractVarint(parser).chain((keyType) =>
            // Parse keyData
            Maybe.fromNullable(
              parser.extractFieldByLength(keyLen.value - keyType.sizeInBytes),
            ).map((keyData) => new Key(keyType.value, keyData)),
          ),
        )
    );
  }

  serialize(builder: ByteArrayBuilder, key: Key) {
    encodeVarint(key.keyType).ifJust((keyType) =>
      encodeVarint(keyType.length + key.keyData.length).ifJust((keyLen) => {
        builder.addBufferToData(keyLen);
        builder.addBufferToData(keyType);
        builder.addBufferToData(key.keyData);
      }),
    );
  }
}

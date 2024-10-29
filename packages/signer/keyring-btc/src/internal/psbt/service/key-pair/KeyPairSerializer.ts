import {
  type ByteArrayBuilder,
  type ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { type Maybe } from "purify-ts";

import { type KeyPair } from "@internal/psbt/model/KeyPair";
import { type Value } from "@internal/psbt/model/Value";

export interface KeyPairSerializer {
  deserialize(parser: ByteArrayParser): Maybe<KeyPair>;
  serialize(builder: ByteArrayBuilder, keyPair: KeyPair): void;
  deserializeMap(parser: ByteArrayParser): Map<string, Value>;
  serializeMap(builder: ByteArrayBuilder, map: Map<string, Value>): void;
}

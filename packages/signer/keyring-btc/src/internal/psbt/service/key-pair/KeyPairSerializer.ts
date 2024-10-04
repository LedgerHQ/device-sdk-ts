import {
  ByteArrayBuilder,
  ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { KeyPair } from "@internal/psbt/model/KeyPair";
import { Value } from "@internal/psbt/model/Value";

export interface KeyPairSerializer {
  deserialize(parser: ByteArrayParser): Maybe<KeyPair>;
  serialize(builder: ByteArrayBuilder, keyPair: KeyPair): void;
  deserializeMap(parser: ByteArrayParser): Map<string, Value>;
  serializeMap(builder: ByteArrayBuilder, map: Map<string, Value>): void;
}

import {
  ByteArrayBuilder,
  ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { Key } from "@internal/psbt/model/Key";

export interface KeySerializer {
  deserialize(parser: ByteArrayParser): Maybe<Key>;
  serialize(builder: ByteArrayBuilder, key: Key): void;
}

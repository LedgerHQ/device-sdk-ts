import {
  type ByteArrayBuilder,
  type ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { type Maybe } from "purify-ts";

import { type Key } from "@internal/psbt/model/Key";

export interface KeySerializer {
  deserialize(parser: ByteArrayParser): Maybe<Key>;
  serialize(builder: ByteArrayBuilder, key: Key): void;
}

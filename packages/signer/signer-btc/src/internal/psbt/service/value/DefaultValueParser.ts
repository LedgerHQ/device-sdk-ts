import { ByteArrayParser } from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { extractVarint } from "@internal/utils/Varint";

export class DefaultValueParser implements ValueParser {
  getInt32LE(data: Uint8Array): Maybe<number> {
    return Maybe.fromNullable(new ByteArrayParser(data).extract32BitInt(false));
  }

  getUInt32LE(data: Uint8Array): Maybe<number> {
    return Maybe.fromNullable(
      new ByteArrayParser(data).extract32BitUInt(false),
    );
  }

  getVarint(data: Uint8Array): Maybe<number> {
    return extractVarint(new ByteArrayParser(data)).map(
      (varint) => varint.value,
    );
  }
}

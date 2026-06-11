import { type Either } from "purify-ts";

import { type DataReader, DefaultDataReader } from "./dataReaders";
import { decodePoolBytes } from "./TypePoolDecoder";
import { type TypePoolDecoderError } from "./TypePoolDecoderError";
import {
  type SelectedEnumVariant,
  type VariantCache,
  variantCacheKey,
} from "./types";

/**
 * Find the `(enumId, variantIndex)` pairs the instruction data selects,
 * deduplicated in first-seen order. Lets callers stream only the observed
 * `ENUM_VARIANT` descriptors to the device rather than all variants.
 *
 * @param typePool raw `IDL_TYPE_POOL` TLV value (`u8 count || entries…`).
 * @param rootType `IDL_ROOT_TYPE` pool index to start the decode from.
 * @param enumCache variant payload metadata; needed to advance past a payload
 * so enums *after* it are reached.
 * @param data the instruction-data buffer.
 * @param dataReader scalar decoder (defaults to {@link DefaultDataReader}).
 */
export function findSelectedEnumVariants(
  typePool: Uint8Array,
  rootType: number,
  enumCache: VariantCache,
  data: Uint8Array,
  dataReader: DataReader = new DefaultDataReader(),
): Either<TypePoolDecoderError, SelectedEnumVariant[]> {
  return decodePoolBytes(typePool, rootType, enumCache, data, dataReader).map(
    (result) => {
      const seen = new Set<string>();
      const deduped: SelectedEnumVariant[] = [];
      for (const selected of result.selectedEnumVariants) {
        const key = variantCacheKey(selected.enumId, selected.variantIndex);
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(selected);
        }
      }
      return deduped;
    },
  );
}

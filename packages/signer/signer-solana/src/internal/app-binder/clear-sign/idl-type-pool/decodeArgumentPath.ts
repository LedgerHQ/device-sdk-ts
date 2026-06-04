import { type Either, Maybe } from "purify-ts";

import { pathsEqual } from "./argumentPaths";
import { type DataReader, DefaultDataReader } from "./dataReaders";
import { decodePoolBytes } from "./TypePoolDecoder";
import { type TypePoolDecoderError } from "./TypePoolDecoderError";
import { type LeafValue, type VariantCache } from "./types";

/**
 * Decode the leaf value at a given argument path. Returns `Nothing` when no
 * leaf is emitted at that path (e.g. a non-selected option) — a valid outcome,
 * not an error; malformed bytes surface as a typed {@link TypePoolDecoderError} `Left`.
 *
 * @param typePool raw `IDL_TYPE_POOL` TLV value (`u8 count || entries…`).
 * @param rootType `IDL_ROOT_TYPE` pool index to start the decode from.
 * @param enumCache variant payload metadata keyed by `(enumId, variantIndex)`.
 * @param path packed argument path (`u8 step_count || <packed steps>`).
 * @param data the instruction-data buffer.
 * @param dataReader scalar decoder (defaults to {@link DefaultDataReader}).
 */
export function decodeArgumentPath(
  typePool: Uint8Array,
  rootType: number,
  enumCache: VariantCache,
  path: Uint8Array,
  data: Uint8Array,
  dataReader: DataReader = new DefaultDataReader(),
): Either<TypePoolDecoderError, Maybe<LeafValue>> {
  return decodePoolBytes(typePool, rootType, enumCache, data, dataReader).map(
    (result) =>
      Maybe.fromNullable(
        result.leaves.find((leaf) => pathsEqual(leaf.path, path))?.value,
      ),
  );
}

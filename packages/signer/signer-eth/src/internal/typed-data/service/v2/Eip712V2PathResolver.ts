import { type Eip712Path } from "@ledgerhq/context-module";
import { Either } from "purify-ts";

import {
  ArrayType,
  type FieldType,
  type PrimitiveType,
  type StructName,
  StructType,
} from "@internal/typed-data/model/Types";
import { encodeTypedDataValue } from "@internal/typed-data/service/TypedDataEncoder";

import { type Eip712V2Types } from "./Eip712V2SchemaBuilder";

// Where a path stands in the value tree: an array is entered one dimension at a time,
// outermost first, so its cursor keeps the index of the dimension left to open.
type Cursor =
  | { kind: "struct"; name: StructName; value: unknown }
  | { kind: "array"; type: ArrayType; level: number; value: unknown }
  | { kind: "leaf"; type: PrimitiveType; bytes: Uint8Array };

/**
 * Resolve an EIP712_PATH against the message, as the device does, into the leaves it
 * selects: each one in its leaf encoding, sliced when the path ends with a leaf slice.
 *
 * https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/tlv_structs.md#eip712_path
 */
export function resolveEip712V2Path(
  types: Eip712V2Types,
  primaryType: string,
  message: Record<string, unknown>,
  path: Eip712Path,
): Either<Error, Uint8Array[]> {
  return Either.encase(() => {
    let cursors: Cursor[] = [
      { kind: "struct", name: primaryType, value: message },
    ];

    for (const step of path) {
      switch (step.type) {
        case "STRUCT_FIELD":
          cursors = cursors.map((cursor) =>
            enterField(types, cursor, step.index),
          );
          break;
        case "ARRAY_SLICE":
          cursors = cursors.flatMap((cursor) =>
            enterArray(cursor, step.start, step.end),
          );
          break;
        case "LEAF_SLICE":
          cursors = cursors.map((cursor) =>
            sliceLeaf(cursor, step.start, step.end),
          );
          break;
      }
    }

    return cursors.map((cursor) => {
      if (cursor.kind !== "leaf") {
        throw new Error(`The path ends on a ${cursor.kind}, not on a leaf`);
      }
      return cursor.bytes;
    });
  });
}

function enterField(
  types: Eip712V2Types,
  cursor: Cursor,
  index: number,
): Cursor {
  if (cursor.kind !== "struct") {
    throw new Error(`A struct field step applies to a ${cursor.kind}`);
  }
  const fields = types[cursor.name];
  if (fields === undefined) {
    throw new Error(`Unknown struct ${cursor.name} in types definition`);
  }
  const field = Object.entries(fields)[index];
  if (field === undefined) {
    throw new Error(`Struct ${cursor.name} has no field ${index}`);
  }
  const [name, type] = field;
  if (
    typeof cursor.value !== "object" ||
    cursor.value === null ||
    !(name in cursor.value)
  ) {
    throw new Error(`Missing value for ${cursor.name}.${name}`);
  }
  return toCursor(type, (cursor.value as Record<string, unknown>)[name]);
}

function enterArray(
  cursor: Cursor,
  start: number | undefined,
  end: number | undefined,
): Cursor[] {
  if (cursor.kind !== "array") {
    throw new Error(`An array slice step applies to a ${cursor.kind}`);
  }
  if (!Array.isArray(cursor.value)) {
    throw new TypeError(`Expected an array for ${cursor.type.typeName}`);
  }
  const [from, to] = resolveBounds(cursor.value.length, start, end);

  return cursor.value
    .slice(from, to)
    .map((element) =>
      cursor.level === 0
        ? toCursor(cursor.type.rootType, element)
        : { ...cursor, level: cursor.level - 1, value: element },
    );
}

function sliceLeaf(
  cursor: Cursor,
  start: number | undefined,
  end: number | undefined,
): Cursor {
  if (cursor.kind !== "leaf") {
    throw new Error(`A leaf slice step applies to a ${cursor.kind}`);
  }
  const [from, to] = resolveBounds(cursor.bytes.length, start, end);
  // unlike an array slice, a leaf slice has to keep at least one byte
  if (to <= from) {
    throw new Error(`The leaf slice [${start}, ${end}) keeps no byte`);
  }
  return { ...cursor, bytes: cursor.bytes.slice(from, to) };
}

/**
 * The [start, end) range a slice selects in a sequence of the given length. A negative
 * bound counts from the end, and a range reaching outside the sequence is refused. An
 * empty or inverted range selects nothing.
 */
function resolveBounds(
  length: number,
  start: number | undefined,
  end: number | undefined,
): [number, number] {
  const from = start === undefined ? 0 : fromEnd(length, start);
  const to = end === undefined ? length : fromEnd(length, end);
  if (from < 0 || to < 0 || to > length) {
    throw new Error(
      `The slice [${start}, ${end}) reaches outside of ${length} elements`,
    );
  }
  return [from, Math.max(from, to)];
}

function fromEnd(length: number, bound: number): number {
  return bound < 0 ? length + bound : bound;
}

function toCursor(type: FieldType | StructType, value: unknown): Cursor {
  if (type instanceof ArrayType) {
    return { kind: "array", type, level: type.levels.length - 1, value };
  }
  if (type instanceof StructType) {
    return { kind: "struct", name: type.typeName, value };
  }
  return {
    kind: "leaf",
    type,
    bytes: encodeTypedDataValue(type, value).caseOf({
      Just: (bytes) => bytes,
      Nothing: () => {
        throw new Error(`Value is not encodable as ${type.typeName}`);
      },
    }),
  };
}

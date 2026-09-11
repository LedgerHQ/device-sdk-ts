// EIP712_SCHEMA payload, as specified in
// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/tlv_structs.md#eip712_schema
import { Either, type Maybe, Nothing } from "purify-ts";

import {
  ArrayType,
  type FieldName,
  type FieldType,
  type PrimitiveType,
  type StructName,
  StructType,
} from "@internal/typed-data/model/Types";

import { concatBytes, encodeTlv, encodeTlvAscii, encodeTlvUInt } from "./tlv";

/** Version carried by every EIP-712 V2 TLV structure. */
export const EIP712_V2_STRUCT_VERSION = 1;

/** Solidity base types, numbered as the app's SolType enum. */
export enum SolType {
  Struct = 0x00,
  Int = 0x01,
  Uint = 0x02,
  Address = 0x03,
  Bool = 0x04,
  String = 0x05,
  BytesFix = 0x06,
  BytesDyn = 0x07,
}

enum SchemaTag {
  Version = 0x00,
  Struct = 0x01,
}

enum StructTag {
  Version = 0x00,
  Name = 0x01,
  Field = 0x02,
}

enum FieldTag {
  Version = 0x00,
  Name = 0x01,
  Type = 0x02,
  TypeSize = 0x03,
  ArrayDim = 0x04,
  StructName = 0x05,
}

export type Eip712V2Types = Record<StructName, Record<FieldName, FieldType>>;

/**
 * Encode the whole type dictionary as the single TLV blob V2 delivers it in.
 *
 * The types come from TypedDataParser, which appends the EIP712Domain struct when the
 * message omits it, so the domain type the app matches by name is always present here.
 */
export function buildEip712V2Schema(
  types: Eip712V2Types,
): Either<Error, Uint8Array> {
  return Either.encase(() =>
    concatBytes([
      encodeTlvUInt(SchemaTag.Version, EIP712_V2_STRUCT_VERSION),
      ...Object.entries(types).map(([name, fields]) =>
        encodeTlv(SchemaTag.Struct, encodeStruct(name, fields)),
      ),
    ]),
  );
}

function encodeStruct(
  name: StructName,
  fields: Record<FieldName, FieldType>,
): Uint8Array {
  return concatBytes([
    encodeTlvUInt(StructTag.Version, EIP712_V2_STRUCT_VERSION),
    encodeTlvAscii(StructTag.Name, name),
    // Entries are addressed by position in the value tree, so declaration order is
    // load-bearing here, not merely informative.
    ...Object.entries(fields).map(([fieldName, fieldType]) =>
      encodeTlv(StructTag.Field, encodeField(fieldName, fieldType)),
    ),
  ]);
}

function encodeField(name: FieldName, type: FieldType): Uint8Array {
  // An array field describes its element type, plus one ARRAY_DIM per dimension.
  const baseType = type instanceof ArrayType ? type.rootType : type;
  const dimensions = type instanceof ArrayType ? type.levels : [];

  const parts = [
    encodeTlvUInt(FieldTag.Version, EIP712_V2_STRUCT_VERSION),
    encodeTlvAscii(FieldTag.Name, name),
    encodeTlvUInt(FieldTag.Type, solTypeOf(baseType)),
  ];

  // Tags are emitted in ascending order, as the reference client does: TYPE_SIZE, then
  // every ARRAY_DIM, then STRUCT_NAME last.
  typeSizeOf(baseType).ifJust((size) =>
    parts.push(encodeTlvUInt(FieldTag.TypeSize, size)),
  );

  // levels is ordered from the base type outwards, which is the innermost-first order
  // ARRAY_DIM entries are declared in.
  for (const level of dimensions) {
    parts.push(
      level.mapOrDefault(
        (size) => encodeTlvUInt(FieldTag.ArrayDim, size),
        // An empty payload marks the dimension dynamic; its presence marks it fixed,
        // which is why a fixed dimension of zero still carries an explicit zero byte.
        encodeTlv(FieldTag.ArrayDim, new Uint8Array()),
      ),
    );
  }

  if (baseType instanceof StructType) {
    parts.push(encodeTlvAscii(FieldTag.StructName, baseType.typeName));
  }

  return concatBytes(parts);
}

/** The SolType number the app uses for a base type. */
function solTypeOf(type: PrimitiveType | StructType): SolType {
  if (type instanceof StructType) {
    return SolType.Struct;
  }
  switch (type.name) {
    case "int":
      return SolType.Int;
    case "uint":
      return SolType.Uint;
    case "address":
      return SolType.Address;
    case "bool":
      return SolType.Bool;
    case "string":
      return SolType.String;
    case "bytes":
      // A size suffix is what separates the fixed-size type from the dynamic one.
      return type.size.isJust() ? SolType.BytesFix : SolType.BytesDyn;
  }
}

/**
 * The TYPE_SIZE a base type carries, if any. It is required for INT/UINT/BYTES_FIX and
 * must be absent for the dynamic types, which have no fixed size by definition.
 */
function typeSizeOf(type: PrimitiveType | StructType): Maybe<number> {
  if (type instanceof StructType) {
    return Nothing;
  }
  switch (type.name) {
    case "int":
    case "uint":
      if (type.size.isNothing()) {
        throw new Error(`Type ${type.typeName} is missing its size`);
      }
      return type.size;
    case "bytes":
      return type.size;
    case "address":
    case "bool":
    case "string":
      return Nothing;
  }
}

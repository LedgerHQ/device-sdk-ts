import { Maybe } from "purify-ts";

export type StructName = string;
export type FieldName = string;
export type FieldType = PrimitiveType | ArrayType | StructType;
export type PrimitiveTypeName =
  | "int"
  | "uint"
  | "address"
  | "bytes"
  | "string"
  | "bool";

// Basic type (address, bool, uint256, etc)
export class PrimitiveType {
  constructor(
    public typeName: string,
    public name: PrimitiveTypeName,
    public size: Maybe<number>,
  ) {}
}

// Arrays
export class ArrayType {
  constructor(
    public typeName: string,
    public rootType: PrimitiveType | StructType,
    public rowType: string,
    public count: Maybe<number>,
    public levels: Array<Maybe<number>>,
  ) {}
}

// Custom structure
export class StructType {
  constructor(public typeName: string) {}
}

// Typed data field value and metadata
export interface TypedDataValue {
  path: string;
  type: string;
  value: TypedDataValueRoot | TypedDataValueArray | TypedDataValueField;
}

// The value is a message root. This is usually the primaryType name.
export class TypedDataValueRoot {
  constructor(public root: string) {}
}
// The value is an array. Represents the array length.
export class TypedDataValueArray {
  constructor(public length: number) {}
}
// The value is a field of any type. Contains the encoded value as a byte array.
export class TypedDataValueField {
  constructor(public data: Uint8Array) {}
}

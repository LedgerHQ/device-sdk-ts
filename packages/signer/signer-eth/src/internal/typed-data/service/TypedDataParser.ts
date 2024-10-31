import { type Either, Just, Left, Maybe, Nothing, Right } from "purify-ts";

import { type TypedDataField } from "@api/model/TypedData";
import {
  ArrayType,
  type FieldName,
  type FieldType,
  PrimitiveType,
  type StructName,
  StructType,
  type TypedDataValue,
  TypedDataValueArray,
  TypedDataValueField,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";

import { encodeTypedDataValue } from "./TypedDataEncoder";

/**
 * A parser for EIP-712 typed data messages.
 *
 * ```typescript
 * const types = {
 *   Person: [
 *     { name: 'name', type: 'string' },
 *     { name: 'age', type: 'uint256' },
 *     { name: "wallets", type: "address[]" },
 *   ],
 * };
 * const parser = new TypedDataParser(types);
 *
 * const message = {
 *   name: 'Alice',
 *   age: 30,
 *   wallets: [
 *     "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
 *     "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
 *   ],
 * };
 * const rootType = 'Person';
 *
 * const result = parser.parse(rootType, message);
 * ```
 */
export class TypedDataParser {
  private readonly structs: Record<StructName, Record<FieldName, FieldType>>;

  /**
   * Creates a new instance of the TypedDataParser class.
   * @param types The types to be used for parsing the message.
   */
  constructor(types: Record<string, Array<TypedDataField>>) {
    // Parse the types to be used later for parsing a message.
    const structs: Record<StructName, Record<FieldName, FieldType>> = {};
    for (const [typedName, typedData] of Object.entries(types)) {
      const parsedTypedData: Record<FieldName, FieldType> = {};
      for (const data of typedData) {
        parsedTypedData[data.name] = this.parseType(data.type);
      }
      structs[typedName] = parsedTypedData;
    }
    this.structs = structs;
  }

  /**
   * Returns the parsed definitions of custom structs as defined in the types passed to the constructor.
   * @returns The struct definitions.
   */
  public getStructDefinitions(): Record<
    StructName,
    Record<FieldName, FieldType>
  > {
    return this.structs;
  }

  /**
   * Parses a message according to the primary type and the types passed to the constructor.
   * @param primaryType The root type of the message.
   * @param message The message to parse.
   * @returns An Either containing the parsed values or an error.
   */
  public parse(
    primaryType: string,
    message: unknown,
  ): Either<Error, Array<TypedDataValue>> {
    if (!this.isRecord(message)) {
      return Left(new Error("Message is not a record"));
    }
    const values: Array<TypedDataValue> = [
      {
        path: "",
        type: "",
        value: new TypedDataValueRoot(primaryType),
      },
    ];
    return this.visitValue(primaryType, message, "", (val) => values.push(val))
      ? Right(values)
      : Left(new Error("Failed to parse"));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  /**
   * Parses a type string description into a PrimitiveType, ArrayType, or StructType object.
   * The description string should match https://eips.ethereum.org/EIPS/eip-712#definition-of-typed-structured-data-%F0%9D%95%8A
   * Any string which doesn't match those patterns is considered a custom struct.
   * @param type The type string to parse.
   * @returns The parsed type object.
   */
  private parseType(type: string): PrimitiveType | ArrayType | StructType {
    return this.tryParsePrimitiveType(type).mapOrDefault(
      (just) => just,
      this.tryParseArrayType(type).mapOrDefault(
        (just) => just,
        new StructType(type),
      ),
    );
  }

  private tryParsePrimitiveType(type: string): Maybe<PrimitiveType> {
    // int8 to int256 and uint8 to uint256
    {
      const match = type.match(/^(((u?)int)(\d+))$/);
      if (match) {
        const size = parseInt(match[4]!);
        if (size % 8 !== 0 || size === 0 || size > 256) {
          return Nothing; // Unsupported number
        }
        return Just(
          new PrimitiveType(
            match[1]!, // typeName such as uint64
            match[3] ? "uint" : "int", // name such as uint
            Just(size / 8), // size in bytes such as 8 for an uint64
          ),
        );
      }
    }

    // bytes1 to bytes32, or bytes (dynamic size)
    {
      const match = type.match(/^((bytes)(\d*))$/);
      if (match) {
        const size = match[3] ? parseInt(match[3]) : null;
        if (size !== null && (size === 0 || size > 32)) {
          return Nothing; // Unsupported  byte array
        }
        return Just(
          new PrimitiveType(
            match[1]!, // typename such as bytes32
            "bytes", // name
            Maybe.fromNullable(size), // size in bytes, or null for a dynamic size
          ),
        );
      }
    }

    // Other primitive types
    if (type === "address" || type === "bool" || type === "string") {
      return Just(
        new PrimitiveType(
          type, // typeName
          type, // name
          Nothing, // size not applicable for those types
        ),
      );
    }

    // Not a primitive type
    return Nothing;
  }

  private tryParseArrayType(type: string): Maybe<ArrayType> {
    // Try to match an array such as: foo[2][][3]
    const match = type.match(/^([^[[]*)(((\[\d*\])*)\[\d*\])$/);
    if (match) {
      const matchLevels = [...match[2]!.matchAll(/\[(\d*)\]/g)];
      if (matchLevels && matchLevels.length > 0) {
        const levels = matchLevels.map(([, size]) =>
          size ? Just(parseInt(size)) : Nothing,
        );
        const rootType = this.tryParsePrimitiveType(match[1]!).mapOrDefault(
          (just) => just,
          new StructType(match[1]!),
        );
        return Just(
          new ArrayType(
            type, // typeName such as: foo[2][][3]
            rootType, // rootType such as: foo
            match[1]! + match[3], // rowType such as: foo[2][]
            levels[levels.length - 1]!, // rows count such as: 3
            levels, // All levels for that array (null for dynamic size), such as: [2, null, 3]
          ),
        );
      }
    }

    // Not an array
    return Nothing;
  }

  /**
   * Visits a value and its children recursively, parsing them into TypedDataValue objects.
   * @param type The type of the value.
   * @param value The value to visit.
   * @param path The path of the value.
   * @param callback The callback to call for each parsed value.
   * @returns True if the value and its children were successfully parsed, false otherwise.
   */
  private visitValue(
    type: string,
    value: unknown,
    path: string,
    callback: (parsedValue: TypedDataValue) => void,
  ): boolean {
    return (
      this.tryVisitStructValue(type, value, path, callback) ||
      this.tryVisitPrimitiveValue(type, value, path, callback) ||
      this.tryVisitArrayValue(type, value, path, callback)
    );
  }

  private tryVisitPrimitiveValue(
    type: string,
    value: unknown,
    path: string,
    callback: (parsedValue: TypedDataValue) => void,
  ): boolean {
    // Basic type (address, bool, uint256, etc)
    return (
      !this.isRecord(value) &&
      !Array.isArray(value) &&
      this.tryParsePrimitiveType(type)
        .chain((primitiveType) =>
          encodeTypedDataValue(primitiveType, value).ifJust((encoded) => {
            callback({
              path,
              type,
              value: new TypedDataValueField(encoded),
            });
          }),
        )
        .isJust()
    );
  }

  private tryVisitStructValue(
    type: string,
    value: unknown,
    path: string,
    callback: (parsedValue: TypedDataValue) => void,
  ): boolean {
    const structType = this.structs[type];
    if (structType === undefined || !this.isRecord(value)) {
      return false;
    }
    for (const [fieldName, fieldType] of Object.entries(structType)) {
      const fieldValue = value[fieldName];
      if (fieldValue === undefined) {
        return false;
      }
      const nextPath = path.length ? `${path}.${fieldName}` : fieldName;
      if (
        !this.visitValue(
          fieldType.typeName,
          fieldValue,
          `${nextPath}`,
          callback,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  private tryVisitArrayValue(
    type: string,
    value: unknown,
    path: string,
    callback: (parsedValue: TypedDataValue) => void,
  ): boolean {
    return (
      Array.isArray(value) &&
      this.tryParseArrayType(type)
        .filter((t) => t.count.mapOrDefault((c) => value.length == c, true))
        .mapOrDefault((t) => {
          callback({
            path: path,
            type,
            value: new TypedDataValueArray(value.length),
          });
          for (const entry of value) {
            const nextPath = path.length ? `${path}.[]` : "[]";
            if (!this.visitValue(t.rowType, entry, `${nextPath}`, callback)) {
              return false;
            }
          }
          return true;
        }, false)
    );
  }
}

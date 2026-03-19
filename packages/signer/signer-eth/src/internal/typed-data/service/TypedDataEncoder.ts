import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { Just, Maybe, Nothing } from "purify-ts";

import {
  type PrimitiveType,
  type PrimitiveTypeName,
} from "@internal/typed-data/model/Types";

const BITS_PER_BYTE = 8;
const ADDRESS_SIZE = 20;
const HEX_RADIX = 16;
const BIGINT_0 = 0n;
const BIGINT_1 = 1n;

/**
 * Encodes a typed data value according to its type.
 * @param type The type of the value to encode.
 * @param value The value to encode into a byte array.
 * @returns An optional Uint8Array containing the encoded value, if the value was encodable for the given type.
 */
export function encodeTypedDataValue(
  type: PrimitiveType,
  value: unknown,
): Maybe<Uint8Array> {
  switch (type.name) {
    case "string":
      // Encode the value as a UTF-8 string
      return typeof value !== "string"
        ? Nothing
        : Just(new TextEncoder().encode(value));
    case "bytes":
    case "address":
      // Encode the hexadecimal string as bytes
      return typeof value !== "string"
        ? Nothing
        : encodeTypedDataBytes(type, value);
    case "bool":
    case "uint":
    case "int":
      // Convert boolean values to numbers, so it can then be encoded as a number
      if (type.name === "bool" && typeof value === "boolean") {
        value = Number(value);
      }
      // Encode the value as a number
      return typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "bigint"
        ? Nothing
        : encodeTypedDataNumber(
            type.name,
            type.size.mapOrDefault((s) => s * BITS_PER_BYTE, 1),
            value,
          );
  }
}

function encodeTypedDataBytes(
  type: PrimitiveType,
  value: string,
): Maybe<Uint8Array> {
  const maxSize = type.name === "address" ? Just(ADDRESS_SIZE) : type.size;
  const buffer = Maybe.fromNullable(hexaStringToBuffer(value));
  return buffer.filter((b) => maxSize.mapOrDefault((s) => b.length <= s, true));
}

function encodeTypedDataNumber(
  type: PrimitiveTypeName,
  sizeInBits: number,
  value: string | number | bigint,
): Maybe<Uint8Array> {
  // Convert the value to a bigint
  let bigintValue: bigint;
  switch (typeof value) {
    case "bigint":
      bigintValue = value;
      break;
    case "number":
      if (!Number.isInteger(value)) {
        return Nothing;
      }
      bigintValue = BigInt(value);
      break;
    case "string":
      if (value.length === 0) {
        return Nothing;
      }
      try {
        bigintValue = BigInt(value);
      } catch (_error: unknown) {
        return Nothing;
      }
      break;
  }
  // Check the bounds of the value and convert it to two's complement if it is signed and negative
  const signed = type === "int";
  return checkBoundsAndConvert(bigintValue, BigInt(sizeInBits), signed).chain(
    (converted) =>
      Maybe.fromNullable(hexaStringToBuffer(converted.toString(HEX_RADIX))),
  );
}

/**
 * Checks the bounds of a signed or unsigned integer value and converts it to two's complement if it is signed and negative.
 * @param value The value to check and convert.
 * @param sizeInBits The size of the value in bits.
 * @param signed Whether the value is signed or unsigned.
 * @returns The converted value, or null if the value is out of bounds.
 */
function checkBoundsAndConvert(
  value: bigint,
  sizeInBits: bigint,
  signed: boolean,
): Maybe<bigint> {
  if (!signed) {
    // Check if the value is within the bounds of an unsigned integer
    return value >= BIGINT_0 && value < BIGINT_1 << sizeInBits
      ? Just(value)
      : Nothing;
  }

  // Check if the value is within the bounds of a signed integer
  const limit = BIGINT_1 << (sizeInBits - BIGINT_1);
  if (value >= limit || value < -limit) {
    return Nothing;
  }

  // Convert the value to two's complement if it is negative
  // https://en.wikipedia.org/wiki/Two%27s_complement
  if (value < BIGINT_0) {
    const mask = (BIGINT_1 << sizeInBits) - BIGINT_1;
    value = -value;
    value = (~value & mask) + BIGINT_1;
  }

  return Just(value);
}

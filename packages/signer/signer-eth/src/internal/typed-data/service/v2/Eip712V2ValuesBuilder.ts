// EIP712_VALUES payload, as specified in
// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/tlv_structs.md#eip712_values
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Either } from "purify-ts";

import {
  ArrayType,
  type FieldType,
  type PrimitiveType,
  type StructName,
  StructType,
} from "@internal/typed-data/model/Types";
import { encodeTypedDataValue } from "@internal/typed-data/service/TypedDataEncoder";

import {
  EIP712_V2_STRUCT_VERSION,
  type Eip712V2Types,
} from "./Eip712V2SchemaBuilder";
import { concatBytes, encodeTlv, encodeTlvAscii, encodeTlvUInt } from "./tlv";

/** The domain struct the EIP-712 standard names, matched by the app on the exact string. */
const DOMAIN_STRUCT_NAME = "EIP712Domain";

/** BIP-32 path components are a uint32 array, so each one keeps its full width. */
const PATH_COMPONENT_BYTES = 4;

enum ValuesTag {
  Version = 0x00,
  PrimaryType = 0x01,
  DerivationPath = 0x02,
  Domain = 0x03,
  Message = 0x04,
}

enum SeqTag {
  Leaf = 0x00,
  Seq = 0x01,
}

export type Eip712V2ValuesInput = {
  types: Eip712V2Types;
  primaryType: string;
  derivationPath: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
};

/**
 * Encode the domain and message value trees as the single TLV blob V2 delivers them in.
 *
 * Values are addressed by their position in the sequence rather than by a path, so this
 * walks the schema rather than the JSON: field order comes from the type declaration, and
 * whether a nested sequence is an array dimension or a struct instance is never stated on
 * the wire because the schema already settles it at every position.
 */
export function buildEip712V2Values(
  input: Eip712V2ValuesInput,
): Either<Error, Uint8Array> {
  return Either.encase(() =>
    concatBytes([
      encodeTlvUInt(ValuesTag.Version, EIP712_V2_STRUCT_VERSION),
      // PRIMARY_TYPE has to precede EIP712_MESSAGE: it names the struct the message's root
      // sequence is an instance of.
      encodeTlvAscii(ValuesTag.PrimaryType, input.primaryType),
      encodeTlv(
        ValuesTag.DerivationPath,
        encodeDerivationPath(input.derivationPath),
      ),
      encodeTlv(
        ValuesTag.Domain,
        encodeStructBody(input.types, DOMAIN_STRUCT_NAME, input.domain),
      ),
      encodeTlv(
        ValuesTag.Message,
        encodeStructBody(input.types, input.primaryType, input.message),
      ),
    ]),
  );
}

/** Pack the path as a bare uint32 array: the app derives its length from the payload size. */
function encodeDerivationPath(derivationPath: string): Uint8Array {
  const components = DerivationPathUtils.splitPath(derivationPath);
  const encoded = new Uint8Array(components.length * PATH_COMPONENT_BYTES);
  components.forEach((component, index) => {
    const offset = index * PATH_COMPONENT_BYTES;
    encoded[offset] = (component >>> 24) & 0xff;
    encoded[offset + 1] = (component >>> 16) & 0xff;
    encoded[offset + 2] = (component >>> 8) & 0xff;
    encoded[offset + 3] = component & 0xff;
  });
  return encoded;
}

/**
 * Encode one struct instance as a sequence body: one entry per declared field, in
 * declaration order. The body is what the caller's tag wraps, so no SEQ is added here.
 */
function encodeStructBody(
  types: Eip712V2Types,
  structName: StructName,
  value: unknown,
): Uint8Array {
  const fields = types[structName];
  if (fields === undefined) {
    throw new Error(`Unknown struct ${structName} in types definition`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected an object for struct ${structName}`);
  }

  const record = value as Record<string, unknown>;
  return concatBytes(
    Object.entries(fields).map(([fieldName, fieldType]) => {
      if (!(fieldName in record)) {
        throw new Error(`Missing value for ${structName}.${fieldName}`);
      }
      return encodeValue(types, fieldType, record[fieldName]);
    }),
  );
}

/** Encode one value as the tagged entry the schema expects at its position. */
function encodeValue(
  types: Eip712V2Types,
  type: FieldType,
  value: unknown,
): Uint8Array {
  if (type instanceof ArrayType) {
    return encodeArray(types, type, type.levels.length - 1, value);
  }
  if (type instanceof StructType) {
    return encodeTlv(SeqTag.Seq, encodeStructBody(types, type.typeName, value));
  }
  return encodeTlv(SeqTag.Leaf, encodeLeaf(type, value));
}

/**
 * Encode one array dimension, outermost first.
 *
 * levels is ordered innermost-first, so the walk starts at its last entry and descends.
 * An element count is never declared: a dimension's cardinality is however many entries
 * its sequence holds, which is what makes jagged arrays unambiguous.
 */
function encodeArray(
  types: Eip712V2Types,
  type: ArrayType,
  levelIndex: number,
  value: unknown,
): Uint8Array {
  if (!Array.isArray(value)) {
    throw new Error(`Expected an array for ${type.typeName}`);
  }

  type.levels[levelIndex]!.ifJust((size) => {
    if (value.length !== size) {
      throw new Error(
        `Array ${type.typeName} holds ${value.length} elements where the schema declares ${size}`,
      );
    }
  });

  return encodeTlv(
    SeqTag.Seq,
    concatBytes(
      value.map((element) =>
        levelIndex === 0
          ? encodeValue(types, type.rootType, element)
          : encodeArray(types, type, levelIndex - 1, element),
      ),
    ),
  );
}

/**
 * Encode one scalar as the raw bytes a LEAF carries.
 *
 * This is the same packed representation V1 sends, which the app pads to 32 bytes on its
 * side, so the encoder is shared between both protocol versions.
 */
function encodeLeaf(type: PrimitiveType, value: unknown): Uint8Array {
  return encodeTypedDataValue(type, value).caseOf({
    Just: (encoded) => encoded,
    Nothing: () => {
      throw new Error(`Value is not encodable as ${type.typeName}`);
    },
  });
}

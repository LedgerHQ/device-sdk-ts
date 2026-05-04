import SHA224 from "crypto-js/sha224";

import type { TypedDataSchema } from "@/shared/model/TypedDataContext";

/**
 * Schema hash is the SHA-224 hex digest of the compact JSON UTF-8 representation
 * of the EIP-712 schema (types object), with keys sorted for deterministic output.
 */
export type SchemaHash = string;

/**
 * Sorts the schema by type name and normalizes each type's fields to { name, type }
 * for deterministic JSON serialization.
 */
function sortSchema(schema: TypedDataSchema): TypedDataSchema {
  return Object.fromEntries(
    Object.entries(schema)
      .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
      .map(([key, value]) => [
        key,
        value.map((v) => ({ name: v.name, type: v.type })),
      ]),
  );
}

/**
 * Computes the schema hash of an EIP-712 schema.
 * Schema hash is SHA-224 of the compact JSON UTF-8 encoded representation of the schema.
 */
export function getSchemaHash(schema: TypedDataSchema): SchemaHash {
  const sortedSchema = sortSchema(schema);
  const schemaStr = JSON.stringify(sortedSchema);
  return SHA224(schemaStr).toString();
}

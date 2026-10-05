import { keccak256, toUtf8Bytes } from "ethers";

import type { TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";

/**
 * Computes keccak256(encodeType(primaryType)) as defined by EIP-712: the primary type
 * followed by every struct type it references, sorted by name.
 */
export function getPrimaryTypeHash(
  schema: TypedDataSchema,
  primaryType: string,
): string {
  const dependencies = new Set<string>();
  const collect = (type: string) => {
    for (const field of schema[type] ?? []) {
      const baseType = field.type.replace(/\[.*$/, "");
      if (
        schema[baseType] !== undefined &&
        baseType !== primaryType &&
        !dependencies.has(baseType)
      ) {
        dependencies.add(baseType);
        collect(baseType);
      }
    }
  };
  collect(primaryType);

  const encodeType = [primaryType, ...[...dependencies].sort()]
    .map(
      (type) =>
        `${type}(${(schema[type] ?? []).map((f) => `${f.type} ${f.name}`).join(",")})`,
    )
    .join("");
  return keccak256(toUtf8Bytes(encodeType));
}

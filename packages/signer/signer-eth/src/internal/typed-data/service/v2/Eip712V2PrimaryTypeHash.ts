import { id } from "ethers";

import { type TypedDataField } from "@api/model/TypedData";

/**
 * keccak256(encodeType(primaryType)), the PRIMARY_TYPE_HASH an EIP712_MESSAGE_INFO is
 * bound to, and the key CAL files the descriptors of a message under.
 *
 * Computed here rather than with ethers' TypedDataEncoder, which refuses a types
 * dictionary holding a type the primary type does not reach, as real messages do.
 */
export function getEip712V2PrimaryTypeHash(
  types: Record<string, TypedDataField[]>,
  primaryType: string,
): string {
  return id(encodeType(types, primaryType));
}

/** The encodeType string of EIP-712: the primary type, then its dependencies by name. */
export function encodeType(
  types: Record<string, TypedDataField[]>,
  primaryType: string,
): string {
  const dependencies = [...collectDependencies(types, primaryType, new Set())]
    .filter((name) => name !== primaryType)
    // code unit order, as ethers sorts: localeCompare would put "a" before "Z"
    .sort((a, b) => Number(a > b) - Number(a < b));

  return [primaryType, ...dependencies]
    .map((name) => {
      const fields = types[name];
      if (fields === undefined) {
        throw new Error(`Unknown struct ${name} in types definition`);
      }
      const members = fields.map((f) => `${f.type} ${f.name}`).join(",");
      return `${name}(${members})`;
    })
    .join("");
}

function collectDependencies(
  types: Record<string, TypedDataField[]>,
  name: string,
  found: Set<string>,
): Set<string> {
  if (found.has(name) || types[name] === undefined) {
    return found;
  }
  found.add(name);
  for (const field of types[name]) {
    // an array of structs depends on the struct of its elements
    const bracket = field.type.indexOf("[");
    const struct = bracket === -1 ? field.type : field.type.slice(0, bracket);
    collectDependencies(types, struct, found);
  }
  return found;
}

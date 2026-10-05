import type { TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";
import type { TypedDataPathElement } from "@/modules/ethereum/typed-data/data/TypedDataDescriptorDataSource";

type Node = { value: unknown; type: string };

/**
 * Returns every message value an EIP712_PATH points to, following the app's resolution
 * rules: https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/tlv_structs.md#eip712_array_slice
 */
export function resolveTypedDataPath(
  schema: TypedDataSchema,
  primaryType: string,
  message: unknown,
  path: TypedDataPathElement[],
): unknown[] {
  let nodes: Node[] = [{ value: message, type: primaryType }];
  for (const element of path) {
    nodes = nodes.flatMap(({ value, type }): Node[] => {
      if (element.type === "struct_field") {
        const field = schema[type]?.[element.index];
        if (
          field === undefined ||
          typeof value !== "object" ||
          value === null
        ) {
          return [];
        }
        return [
          {
            value: (value as Record<string, unknown>)[field.name],
            type: field.type,
          },
        ];
      }

      const itemType = type.replace(/\[\d*\]$/, "");
      if (itemType === type || !Array.isArray(value)) {
        return [];
      }
      const start = normalizeIndex(element.start, 0, value.length);
      const end = normalizeIndex(element.end, value.length, value.length);
      if (start < 0 || end > value.length || end <= start) {
        return [];
      }
      return value
        .slice(start, end)
        .map((item: unknown) => ({ value: item, type: itemType }));
    });
  }
  return nodes.map(({ value }) => value);
}

function normalizeIndex(
  index: number | undefined,
  defaultIndex: number,
  size: number,
): number {
  if (index === undefined) {
    return defaultIndex;
  }
  return index < 0 ? size + index : index;
}

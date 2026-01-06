export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export function stringifyCanonical(value: JsonValue | undefined): string {
  if (value == null) return "null";

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return serializeArray(value);
  }

  return serializeObject(value);
}

function serializeArray(arr: JsonArray): string {
  const out: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    out.push(stringifyCanonical(arr[i]));
  }
  return `[${out.join(",")}]`;
}

function serializeObject(obj: JsonObject): string {
  const keys = Object.keys(obj).sort();
  const out: string[] = [];

  for (const key of keys) {
    const serialized = stringifyCanonical(obj[key]);
    out.push(`${JSON.stringify(key)}:${serialized}`);
  }

  return `{${out.join(",")}}`;
}

import { base64StringToBuffer } from "@ledgerhq/device-management-kit";

interface StdFee {
  readonly amount: readonly StdCoin[];
  readonly gas: string;
}

interface StdCoin {
  readonly denom: string;
  readonly amount: string;
}

interface AminoMsg<Value = unknown> {
  readonly type: string;
  readonly value: Value;
}

export interface StdSignDoc<Value = unknown> {
  readonly chain_id: string;
  readonly account_number: string;
  readonly sequence: string;
  readonly fee: StdFee;
  readonly msgs: readonly AminoMsg<Value>[];
  readonly memo: string;
}
export class SignDoc {
  constructor(public readonly stdSignDoc: StdSignDoc) {}

  serialize(): Uint8Array | null {
    const canonicalJson = stringifyCanonical(
      this.stdSignDoc as unknown as JsonValue,
    );
    return base64StringToBuffer(canonicalJson);
  }

  stringify(): string {
    return stringifyCanonical(this.stdSignDoc as unknown as JsonValue);
  }
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonArray = JsonValue[];

export function stringifyCanonical(value: JsonValue): string {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    const items = value.map((v) => stringifyCanonical(v));
    return `[${items.join(",")}]`;
  }

  if (typeof value === "object") {
    const obj = value as JsonObject;
    const keys = Object.keys(obj).sort();
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${stringifyCanonical(obj[k]!)}`,
    );
    return `{${parts.join(",")}}`;
  }

  return JSON.stringify(value);
}

import {
  type JsonObject,
  type JsonValue,
  stringifyCanonical,
} from "@api/model/Json";

export interface StdFee extends JsonObject {
  readonly amount: StdCoin[];
  readonly gas: string;
}

export interface StdCoin extends JsonObject {
  readonly denom: string;
  readonly amount: string;
}

export interface AminoMsg extends JsonObject {
  readonly type: string;
  readonly value: JsonValue;
}

export interface StdSignDoc extends JsonObject {
  readonly chain_id: string;
  readonly account_number: string;
  readonly sequence: string;
  readonly fee: StdFee;
  readonly msgs: AminoMsg[];
  readonly memo: string;
}

interface CanonicalSignDoc {
  data: StdSignDoc;
  stringify: () => string;
  serialize: () => Uint8Array;
}

export function createSignDoc(doc: StdSignDoc): CanonicalSignDoc {
  return {
    data: doc,
    stringify: () => stringifyCanonical(doc),
    serialize: () => new TextEncoder().encode(stringifyCanonical(doc)),
  };
}

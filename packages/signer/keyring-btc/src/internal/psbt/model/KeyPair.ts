import { Key } from "./Key";
import { Value } from "./Value";

export class KeyPair {
  constructor(
    readonly key: Key,
    readonly value: Value,
  ) {}
}

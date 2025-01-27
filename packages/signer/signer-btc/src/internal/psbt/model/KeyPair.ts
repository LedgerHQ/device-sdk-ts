import { type Key } from "./Key";
import { type Value } from "./Value";

export class KeyPair {
  constructor(
    readonly key: Key,
    readonly value: Value,
  ) {}
}

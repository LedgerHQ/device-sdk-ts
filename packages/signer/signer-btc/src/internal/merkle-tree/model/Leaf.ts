import { type Maybe, Nothing } from "purify-ts";

import { type Node } from "@internal/merkle-tree/model/Node";

export class Leaf {
  public parent: Maybe<Node> = Nothing;

  constructor(
    public value: Uint8Array,
    public hash: Uint8Array,
  ) {}
}

import { type Maybe, Nothing } from "purify-ts";

import { type Leaf } from "./Leaf";

export class Node {
  public parent: Maybe<Node> = Nothing;

  constructor(
    public leftChild: Node | Leaf,
    public rightChild: Node | Leaf,
    public hash: Uint8Array,
  ) {}
}

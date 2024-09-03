import { Maybe, Nothing } from "purify-ts";

export class Node {
  public parent: Maybe<Node> = Nothing;

  constructor(
    public leftChild: Node | Leaf,
    public rightChild: Node | Leaf,
    public hash: Uint8Array,
  ) {}
}

export class Leaf {
  public parent: Maybe<Node> = Nothing;

  constructor(
    public value: Uint8Array,
    public hash: Uint8Array,
  ) {}
}

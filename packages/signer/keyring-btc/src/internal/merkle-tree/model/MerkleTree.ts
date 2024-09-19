import { Maybe } from "purify-ts";

import { Leaf } from "@internal/merkle-tree/model/Leaf";
import { Node } from "@internal/merkle-tree/model/Node";

/**
 * This class implements the merkle tree used by Ledger Bitcoin app v2+,
 * which is documented at
 * https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/merkle.md
 */
export class MerkleTree {
  constructor(
    private root: Node | Leaf,
    private leaves: Leaf[],
  ) {}

  // Get the merkle tree root hash
  getRoot(): Uint8Array {
    return this.root.hash;
  }

  // Get the tree size
  size(): number {
    return this.leaves.length;
  }

  // Get the leaes of that tree
  getLeaves(): Leaf[] {
    return this.leaves;
  }

  // Get the hash of a given leaf index
  getLeafHash(index: number): Maybe<Uint8Array> {
    return Maybe.fromNullable(this.leaves[index]?.hash);
  }

  // Get the merkle proof for a given leaf index
  getProof(index: number): Maybe<Uint8Array[]> {
    return Maybe.fromNullable(this.leaves[index]).map((leaf) =>
      this.proveNode(leaf),
    );
  }
  /**
   * A merkle proof is composed of the sibling node at each stage of the tree.
   * It contains all the nodes necessary to compute the root from the given leaf.
   */
  private proveNode(node: Node | Leaf): Uint8Array[] {
    return node.parent.caseOf({
      Just: (parent) =>
        parent.leftChild === node
          ? [parent.rightChild.hash, ...this.proveNode(parent)]
          : [parent.leftChild.hash, ...this.proveNode(parent)],
      Nothing: () => [],
    });
  }
}

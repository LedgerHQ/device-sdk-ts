import { Just, Maybe } from "purify-ts";

import { type Hasher } from "@internal/merkle-tree/model/Hasher";
import { Leaf, Node } from "@internal/merkle-tree/model/Node";

import { type MerkleTree } from "./MerkleTree";

const HASH_LEAF_PREFIX = 0;
const HASH_NODE_PREFIX = 1;

/**
 * This class implements the merkle tree used by Ledger Bitcoin app v2+,
 * which is documented at
 * https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/merkle.md
 */
export class DefaultMerkleTree implements MerkleTree {
  private root: Node | Leaf;
  private leaves: Leaf[];

  constructor(leaves: Uint8Array[], hasher: Hasher) {
    // Leaves are hashed with a LEAF prefix to prevent second pre-image attacks
    leaves = leaves.map((leaf) => Uint8Array.from([HASH_LEAF_PREFIX, ...leaf]));
    const tree = buildTree(
      leaves.map((leaf) => new Leaf(leaf, hasher(leaf))),
      hasher,
    );
    this.root = tree.root;
    this.leaves = tree.leaves;
  }

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
      proveNode(leaf),
    );
  }
}

/**
 * A merkle proof is composed of the sibling node at each stage of the tree.
 * It contains all the nodes necessary to compute the root from the given leaf.
 */
function proveNode(node: Node | Leaf): Uint8Array[] {
  return node.parent.caseOf({
    Just: (parent) =>
      parent.leftChild === node
        ? [parent.rightChild.hash, ...proveNode(parent)]
        : [parent.leftChild.hash, ...proveNode(parent)],
    Nothing: () => [],
  });
}

/**
 * Create a merkle tree from a list of leaves.
 * This is a recursive function which split the leaves in 2 subtrees, call itself on each subtree,
 * then compute the hash of the parent node.
 */
function buildTree(
  leaves: Leaf[],
  hasher: Hasher,
): {
  root: Node | Leaf;
  leaves: Leaf[];
} {
  if (leaves.length == 0) {
    // Empty tree only should have a hash full of zeros
    return {
      root: new Leaf(new Uint8Array(), Uint8Array.from(Array(32).fill(0))),
      leaves: [],
    };
  } else if (leaves.length == 1) {
    // 1 child means we're at the leaf level, nothing to compute
    return { root: leaves[0]!, leaves };
  }
  // At least 2 children: compute the tree
  const leftCount = highestPowerOf2LessThan(leaves.length);
  const leftBranch = buildTree(leaves.slice(0, leftCount), hasher);
  const rightBranch = buildTree(leaves.slice(leftCount), hasher);
  const leftChild = leftBranch.root;
  const rightChild = rightBranch.root;
  // Nodes are hashed with a NODE prefix to prevent second pre-image attacks
  const hash = hasher(
    Uint8Array.from([HASH_NODE_PREFIX, ...leftChild.hash, ...rightChild.hash]),
  );
  const node = new Node(leftChild, rightChild, hash);
  leftChild.parent = Just(node);
  rightChild.parent = Just(node);
  return { root: node, leaves: [...leftBranch.leaves, ...rightBranch.leaves] };
}

function highestPowerOf2LessThan(n: number): number {
  if (n < 2) {
    // Should not be possible
    throw Error("Expected n >= 2");
  }
  if (isPowerOf2(n)) {
    return n / 2;
  }
  return 1 << Math.floor(Math.log2(n));
}

function isPowerOf2(n: number): boolean {
  return (n & (n - 1)) === 0;
}

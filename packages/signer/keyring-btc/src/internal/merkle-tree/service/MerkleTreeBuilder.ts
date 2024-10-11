import { inject, injectable } from "inversify";
import { Just } from "purify-ts";

import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import { Leaf } from "@internal/merkle-tree/model/Leaf";
import { MerkleTree } from "@internal/merkle-tree/model/MerkleTree";
import { Node } from "@internal/merkle-tree/model/Node";

import { type HasherService } from "./HasherService";

const HASH_LEAF_PREFIX = 0;
const HASH_NODE_PREFIX = 1;

@injectable()
export class MerkleTreeBuilder {
  constructor(
    @inject(merkleTreeTypes.HasherService) private hasher: HasherService,
  ) {}

  build(leaves: Uint8Array[]): MerkleTree {
    // Leaves are hashed with a LEAF prefix to prevent second pre-image attacks
    leaves = leaves.map((leaf) => Uint8Array.from([HASH_LEAF_PREFIX, ...leaf]));
    const tree: {
      root: Node | Leaf;
      leaves: Leaf[];
    } = this.buildTree(
      leaves.map((leaf) => new Leaf(leaf, this.hasher.hash(leaf))),
    );

    return new MerkleTree(tree.root, tree.leaves);
  }

  /**
   * Create a merkle tree from a list of leaves.
   * This is a recursive function which split the leaves in 2 subtrees, call itself on each subtree,
   * then compute the hash of the parent node.
   */
  private buildTree(leaves: Leaf[]): {
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
    const leftCount = this.highestPowerOf2LessThan(leaves.length);
    const leftBranch = this.buildTree(leaves.slice(0, leftCount));
    const rightBranch = this.buildTree(leaves.slice(leftCount));
    const leftChild = leftBranch.root;
    const rightChild = rightBranch.root;
    // Nodes are hashed with a NODE prefix to prevent second pre-image attacks
    const hash = this.hasher.hash(
      Uint8Array.from([
        HASH_NODE_PREFIX,
        ...leftChild.hash,
        ...rightChild.hash,
      ]),
    );
    const node = new Node(leftChild, rightChild, hash);
    leftChild.parent = Just(node);
    rightChild.parent = Just(node);
    return {
      root: node,
      leaves: [...leftBranch.leaves, ...rightBranch.leaves],
    };
  }

  private highestPowerOf2LessThan(n: number): number {
    if (n < 2) {
      // Should not be possible
      throw Error("Expected n >= 2");
    }
    if (this.isPowerOf2(n)) {
      return n / 2;
    }
    return 1 << Math.floor(Math.log2(n));
  }

  private isPowerOf2(n: number): boolean {
    return (n & (n - 1)) === 0;
  }
}

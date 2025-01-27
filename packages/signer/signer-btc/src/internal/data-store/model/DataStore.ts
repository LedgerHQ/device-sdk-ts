import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { Just, Maybe, Nothing } from "purify-ts";

import type { MerkleMap } from "@internal/merkle-tree/model/MerkleMap";
import type { MerkleTree } from "@internal/merkle-tree/model/MerkleTree";

export type MerkleProof = {
  leafHash: Uint8Array;
  proof: Uint8Array[];
};

export class DataStore {
  private merkleTrees: Map<string, MerkleTree> = new Map();
  private preimages: Map<string, Uint8Array> = new Map();

  addPreimage(hash: Uint8Array, preimage: Uint8Array): void {
    this.preimages.set(bufferToHexaString(hash), preimage);
  }

  addMerkleTree(tree: MerkleTree): void {
    // Save each leaf as a preimage
    for (const leaf of tree.getLeaves()) {
      this.preimages.set(bufferToHexaString(leaf.hash), leaf.value);
    }
    // Save the tree
    this.merkleTrees.set(bufferToHexaString(tree.getRoot()), tree);
  }

  addMerkleMap(map: MerkleMap): void {
    this.addMerkleTree(map.keys);
    this.addMerkleTree(map.values);
  }

  getPreimage(hash: Uint8Array): Maybe<Uint8Array> {
    return Maybe.fromNullable(this.preimages.get(bufferToHexaString(hash)));
  }

  getMerkleLeafIndex(
    rootHash: Uint8Array,
    leafHash: Uint8Array,
  ): Maybe<number> {
    return Maybe.fromNullable(
      this.merkleTrees.get(bufferToHexaString(rootHash)),
    ).chain((tree) => {
      const leaves = tree.getLeaves();
      const index = leaves.findIndex(
        (l) => bufferToHexaString(l.hash) === bufferToHexaString(leafHash),
      );
      return index === -1 ? Nothing : Just(index);
    });
  }

  getMerkleProof(rootHash: Uint8Array, leafIndex: number): Maybe<MerkleProof> {
    return Maybe.fromNullable(
      this.merkleTrees.get(bufferToHexaString(rootHash)),
    ).chain((tree) =>
      tree.getLeafHash(leafIndex).chain((leafHash) =>
        tree.getProof(leafIndex).map((proof) => ({
          leafHash,
          proof,
        })),
      ),
    );
  }
}

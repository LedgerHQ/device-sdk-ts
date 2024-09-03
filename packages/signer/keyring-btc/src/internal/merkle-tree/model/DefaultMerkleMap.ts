import { bufferToHexaString } from "@ledgerhq/device-sdk-core";
import { Just, Maybe, Nothing } from "purify-ts";

import { type MerkleTreeService } from "@internal/merkle-tree/service/MerkleTreeService";
import { encodeVarint } from "@internal/utils/Varint";

import { type MerkleMap } from "./MerkleMap";
import { type MerkleTree } from "./MerkleTree";

/**
 * This implements "Merkelized Maps", documented at
 * https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/merkle.md#merkleized-maps
 *
 * A merkelized map consist of two merkle trees, one for the keys of
 * a map and one for the values of the same map, thus the two merkle
 * trees have the same shape. The commitment is the number elements
 * in the map followed by the keys' merkle root followed by the
 * values' merkle root.
 */
export class DefaultMerkleMap implements MerkleMap {
  private constructor(
    private keysTree: MerkleTree,
    private valuesTree: MerkleTree,
  ) {}

  getKeys(): MerkleTree {
    return this.keysTree;
  }
  getValues(): MerkleTree {
    return this.valuesTree;
  }

  /**
   * @param keys Sorted list of distinct keys
   * @param values values, in corresponding order as the keys, and of equal length
   */
  static create(
    keys: Uint8Array[],
    values: Uint8Array[],
    merkleTreeService: MerkleTreeService,
  ): Maybe<DefaultMerkleMap> {
    // Sanity check: keys and values should have the same length
    if (keys.length != values.length) {
      return Nothing;
    }

    // Sanity check: verify that keys are actually sorted and with no duplicates
    for (let i = 0; i < keys.length - 1; i++) {
      if (bufferToHexaString(keys[i]!) >= bufferToHexaString(keys[i + 1]!)) {
        return Nothing;
      }
    }

    // Create merkle trees for both keys and values
    const keysTree = merkleTreeService.create(keys);
    const valuesTree = merkleTreeService.create(values);
    return Just(new DefaultMerkleMap(keysTree, valuesTree));
  }

  /**
   * Get the commitment for that merkle map
   */
  getCommitment(): Uint8Array {
    // Safe to extract the result since an array size cannot overflow a ts number
    const size = encodeVarint(this.keysTree.size()).unsafeCoerce();
    return Uint8Array.from([
      ...size,
      ...this.keysTree.getRoot(),
      ...this.valuesTree.getRoot(),
    ]);
  }
}

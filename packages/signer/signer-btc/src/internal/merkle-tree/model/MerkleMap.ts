import { encodeVarint } from "@internal/utils/Varint";

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
export class MerkleMap {
  constructor(
    public keys: MerkleTree,
    public values: MerkleTree,
  ) {}

  /**
   * Get the commitment for that merkle map
   */
  getCommitment(): Uint8Array {
    // Safe to extract the result since an array size cannot overflow a ts number
    const size = encodeVarint(this.keys.size()).unsafeCoerce();
    return Uint8Array.from([
      ...size,
      ...this.keys.getRoot(),
      ...this.values.getRoot(),
    ]);
  }
}

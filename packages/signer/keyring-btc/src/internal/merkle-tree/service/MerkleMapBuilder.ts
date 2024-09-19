import { bufferToHexaString } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import { MerkleMap } from "@internal/merkle-tree/model/MerkleMap";

import { type MerkleTreeBuilder } from "./MerkleTreeBuilder";

@injectable()
export class MerkleMapBuilder {
  constructor(
    @inject(merkleTreeTypes.MerkleTreeBuilder)
    private merkleTreeBuilder: MerkleTreeBuilder,
  ) {}

  /**
   * @param keys Sorted list of distinct keys
   * @param values values, in corresponding order as the keys, and of equal length
   */
  public build(
    keys: Uint8Array[],
    values: Uint8Array[],
  ): Either<Error, MerkleMap> {
    // Sanity check: keys and values should have the same length
    if (keys.length != values.length) {
      return Left(new Error("Keys and values should have the same length"));
    }

    // Sanity check: verify that keys are actually sorted and with no duplicates
    for (let i = 0; i < keys.length - 1; i++) {
      if (bufferToHexaString(keys[i]!) >= bufferToHexaString(keys[i + 1]!)) {
        return Left(new Error("Keys should be sorted and distinct"));
      }
    }

    // Create merkle trees for both keys and values
    const keysTree = this.merkleTreeBuilder.build(keys);
    const valuesTree = this.merkleTreeBuilder.build(values);
    return Right(new MerkleMap(keysTree, valuesTree));
  }
}

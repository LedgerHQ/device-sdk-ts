import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";

import { MerkleMap } from "./MerkleMap";
import { MerkleTree } from "./MerkleTree";

const KEYS = [
  Uint8Array.from([0, 1, 2, 3]),
  Uint8Array.from([0, 1, 2, 4]),
  Uint8Array.from([0, 1, 2, 5]),
  Uint8Array.from([0, 2, 2, 3]),
  Uint8Array.from([1, 1, 2, 3]),
];

const VALUES = [
  Uint8Array.from([0, 0]),
  Uint8Array.from([0xff, 0xff, 0xff, 0xff]),
  Uint8Array.from([0, 1, 2, 5]),
  Uint8Array.from([0, 0xff]),
  Uint8Array.from([0xfe, 57]),
];

const COMMITMENT_RESULT = Uint8Array.from([
  0x05, 0x01, 0x01, 0x01, 0x00, 0x00, 0x01, 0x02, 0x03, 0x00, 0x00, 0x01, 0x02,
  0x04, 0x01, 0x00, 0x00, 0x01, 0x02, 0x05, 0x00, 0x00, 0x02, 0x02, 0x03, 0x00,
  0x01, 0x01, 0x02, 0x03, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
  0xff, 0xff, 0x01, 0x00, 0x00, 0x01, 0x02, 0x05, 0x00, 0x00, 0xff, 0x00, 0xfe,
  0x39,
]);

describe("MerkleMap", () => {
  const hasherService = { hash: (data: Uint8Array) => data };
  const merkleTreeBuilder = new MerkleTreeBuilder(hasherService);

  it("should be defined", () => {
    expect(MerkleMap).toBeDefined();
  });

  it("should create a MerkleMap instance", () => {
    // GIVEN
    const keys = merkleTreeBuilder.build(KEYS);
    const values = merkleTreeBuilder.build(VALUES);

    // WHEN
    const merkleMap = new MerkleMap(keys, values);

    // THEN
    expect(merkleMap).toBeInstanceOf(MerkleMap);
    expect(merkleMap.keys).toBeInstanceOf(MerkleTree);
    expect(merkleMap.values).toBeInstanceOf(MerkleTree);
  });

  it("should return commitment", () => {
    // GIVEN
    const keys = merkleTreeBuilder.build(KEYS);
    const values = merkleTreeBuilder.build(VALUES);

    // WHEN
    const merkleMap = new MerkleMap(keys, values);

    // THEN
    expect(merkleMap.getCommitment()).toEqual(COMMITMENT_RESULT);
  });
});

import { type MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";

import { MerkleMapBuilder } from "./MerkleMapBuilder";

describe("MerkleMapBuilder", () => {
  const TEST_KEYS = [
    Uint8Array.from([0, 1, 2, 3]),
    Uint8Array.from([0, 1, 2, 4]),
    Uint8Array.from([0, 1, 2, 5]),
    Uint8Array.from([0, 2, 2, 3]),
    Uint8Array.from([1, 1, 2, 3]),
  ];

  const TEST_VALUES = [
    Uint8Array.from([0, 0]),
    Uint8Array.from([0xff, 0xff, 0xff, 0xff]),
    Uint8Array.from([0, 1, 2, 5]),
    Uint8Array.from([0, 0xff]),
    Uint8Array.from([0xfe, 57]),
  ];

  const mockCreateMerkleTree = vi.fn();
  const mockMerkleTree: MerkleTreeBuilder = {
    build: mockCreateMerkleTree,
  } as unknown as MerkleTreeBuilder;
  let builder: MerkleMapBuilder;

  beforeEach(() => {
    vi.resetAllMocks();
    builder = new MerkleMapBuilder(mockMerkleTree);
  });

  it("Invalid value count", () => {
    const eitherMap = builder.build(TEST_KEYS, [
      Uint8Array.from([0]),
      ...TEST_VALUES,
    ]);
    expect(eitherMap.isRight()).toStrictEqual(false);
  });

  it("Invalid ordering", () => {
    const eitherMap = builder.build(
      [Uint8Array.from([0, 1, 2, 5]), ...TEST_KEYS],
      [Uint8Array.from([0]), ...TEST_VALUES],
    );
    expect(eitherMap.isRight()).toStrictEqual(false);
  });

  it("Dupplicate key", () => {
    const eitherMap = builder.build(
      [Uint8Array.from([0, 1, 2, 3]), ...TEST_KEYS],
      [Uint8Array.from([0]), ...TEST_VALUES],
    );
    expect(eitherMap.isRight()).toStrictEqual(false);
  });

  it("correct value", () => {
    mockCreateMerkleTree
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([42, 43]),
        size: () => TEST_KEYS.length,
      })
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([44, 45]),
        size: () => TEST_VALUES.length,
      });

    const eitherMap = builder.build(TEST_KEYS, TEST_VALUES);
    expect(eitherMap.isRight()).toStrictEqual(true);
    expect(mockCreateMerkleTree).toHaveBeenCalledWith(TEST_KEYS);
    expect(mockCreateMerkleTree).toHaveBeenCalledWith(TEST_VALUES);
  });
});

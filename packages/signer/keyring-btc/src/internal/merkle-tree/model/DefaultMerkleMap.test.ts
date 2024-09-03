import { type MerkleTreeService } from "@internal/merkle-tree/service/MerkleTreeService";

import { DefaultMerkleMap } from "./DefaultMerkleMap";

describe("DefaultMerkleMap", () => {
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

  const mockCreateMerkleTree = jest.fn();
  const mockMerkleTree: MerkleTreeService = {
    create: mockCreateMerkleTree,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("Invalid value count", () => {
    const maybeMap = DefaultMerkleMap.create(
      TEST_KEYS,
      [Uint8Array.from([0]), ...TEST_VALUES],
      mockMerkleTree,
    );
    expect(maybeMap.isJust()).toStrictEqual(false);
  });

  it("Invalid ordering", () => {
    const maybeMap = DefaultMerkleMap.create(
      [Uint8Array.from([0, 1, 2, 5]), ...TEST_KEYS],
      [Uint8Array.from([0]), ...TEST_VALUES],
      mockMerkleTree,
    );
    expect(maybeMap.isJust()).toStrictEqual(false);
  });

  it("Dupplicate key", () => {
    const maybeMap = DefaultMerkleMap.create(
      [Uint8Array.from([0, 1, 2, 3]), ...TEST_KEYS],
      [Uint8Array.from([0]), ...TEST_VALUES],
      mockMerkleTree,
    );
    expect(maybeMap.isJust()).toStrictEqual(false);
  });

  it("Get map commitment", () => {
    mockCreateMerkleTree
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([42, 43]),
        size: () => TEST_KEYS.length,
      })
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([44, 45]),
        size: () => TEST_VALUES.length,
      });

    const maybeMap = DefaultMerkleMap.create(
      TEST_KEYS,
      TEST_VALUES,
      mockMerkleTree,
    );
    expect(maybeMap.isJust()).toStrictEqual(true);
    const map = maybeMap.unsafeCoerce();
    expect(map.getCommitment()).toStrictEqual(
      Uint8Array.from([5, 42, 43, 44, 45]),
    );

    expect(mockCreateMerkleTree).toHaveBeenCalledWith(TEST_KEYS);
    expect(mockCreateMerkleTree).toHaveBeenCalledWith(TEST_VALUES);
  });

  it("Get map commitment, with mid size", () => {
    mockCreateMerkleTree
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([42, 43]),
        size: () => 0xdc4591,
      })
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([44, 45]),
        size: () => 0xdc4591,
      });

    const maybeMap = DefaultMerkleMap.create(
      TEST_KEYS,
      TEST_VALUES,
      mockMerkleTree,
    );
    expect(maybeMap.isJust()).toStrictEqual(true);
    const map = maybeMap.unsafeCoerce();

    // example from https://wiki.bitcoinsv.io/index.php/VarInt
    expect(map.getCommitment()).toStrictEqual(
      Uint8Array.from([0xfe, 0x91, 0x45, 0xdc, 0x00, 42, 43, 44, 45]),
    );
  });

  it("Get map commitment, with big size", () => {
    mockCreateMerkleTree
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([42, 43]),
        size: () => 0xb4da564e2857,
      })
      .mockReturnValueOnce({
        getRoot: () => Uint8Array.from([44, 45]),
        size: () => 0xb4da564e2857,
      });

    const maybeMap = DefaultMerkleMap.create(
      TEST_KEYS,
      TEST_VALUES,
      mockMerkleTree,
    );
    expect(maybeMap.isJust()).toStrictEqual(true);
    const map = maybeMap.unsafeCoerce();

    // example from https://wiki.bitcoinsv.io/index.php/VarInt
    expect(map.getCommitment()).toStrictEqual(
      Uint8Array.from([
        0xff, 0x57, 0x28, 0x4e, 0x56, 0xda, 0xb4, 0x00, 0x00, 42, 43, 44, 45,
      ]),
    );
  });
});

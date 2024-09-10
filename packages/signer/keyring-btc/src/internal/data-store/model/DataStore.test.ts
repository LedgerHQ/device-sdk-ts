import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { Leaf } from "@internal/merkle-tree/model/Leaf";
import { MerkleTree } from "@internal/merkle-tree/model/MerkleTree";

import { DataStore } from "./DataStore";

const SMALL_TREE = {
  leaves: [
    new Leaf(Uint8Array.from([0, 0]), Uint8Array.from([42])),
    new Leaf(Uint8Array.from([0, 1]), Uint8Array.from([43])),
    new Leaf(Uint8Array.from([0, 2]), Uint8Array.from([44])),
    new Leaf(Uint8Array.from([0, 3]), Uint8Array.from([45])),
  ],
  proof: [Uint8Array.from([9, 8, 7, 6]), Uint8Array.from([5, 4, 3, 2])],
  root: hexaStringToBuffer(
    "9bcd51240af4005168f033121ba85be5a6ed4f0e6a5fac262066729b8fbfdecb",
  )!,
};

const BIG_TREE = {
  leaves: [
    new Leaf(Uint8Array.from([1, 0]), Uint8Array.from([80])),
    new Leaf(Uint8Array.from([2, 0]), Uint8Array.from([81])),
    new Leaf(Uint8Array.from([3, 0]), Uint8Array.from([82])),
    new Leaf(Uint8Array.from([4, 0]), Uint8Array.from([83])),
    new Leaf(Uint8Array.from([5, 0]), Uint8Array.from([84])),
    new Leaf(Uint8Array.from([6, 0]), Uint8Array.from([85])),
    new Leaf(Uint8Array.from([7, 0]), Uint8Array.from([86])),
    new Leaf(Uint8Array.from([8, 0]), Uint8Array.from([87])),
    new Leaf(Uint8Array.from([9, 0]), Uint8Array.from([88])),
    new Leaf(Uint8Array.from([10, 0]), Uint8Array.from([89])),
  ],
  proof: [
    Uint8Array.from([0xff, 0xfe, 0xfd]),
    Uint8Array.from([1, 2, 3, 4]),
    Uint8Array.from([0xaa, 0xbb, 0xcc]),
    Uint8Array.from([7, 6, 5, 4]),
  ],
  root: hexaStringToBuffer(
    "e177ad5a8a17108dad67c70a51266681aa02b9e2b7ad6a0357585ba4289982ac",
  )!,
};

describe("DataStore", () => {
  // Mocked merkle tree
  const createMerkletree = () => ({
    size: jest.fn(),
    getRoot: jest.fn(),
    getLeaves: jest.fn(),
    getLeafHash: jest.fn(),
    getProof: jest.fn(),
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("Add preimages, then get it", () => {
    // Given
    const data1 = hexaStringToBuffer("deadbeef1")!;
    const data2 = hexaStringToBuffer("deadbeef2")!;
    const dataHash1 = hexaStringToBuffer("42ff1")!;
    const dataHash2 = hexaStringToBuffer("42ff2")!;
    const dataHash3 = hexaStringToBuffer("42ff3")!;
    const store = new DataStore();

    // When
    store.addPreimage(dataHash1, data1);
    store.addPreimage(dataHash2, data2);

    // Then
    const preimage1 = store.getPreimage(dataHash1);
    expect(preimage1.isJust()).toStrictEqual(true);
    expect(preimage1.unsafeCoerce()).toStrictEqual(data1);
    const preimage2 = store.getPreimage(dataHash2);
    expect(preimage2.isJust()).toStrictEqual(true);
    expect(preimage2.unsafeCoerce()).toStrictEqual(data2);
    const preimage3 = store.getPreimage(dataHash3);
    expect(preimage3.isJust()).toStrictEqual(false);
  });

  it("Add merkletrees, then get index", () => {
    // Given
    const invalidRoot = hexaStringToBuffer("deadbeef")!;
    const tree1 = createMerkletree();
    const tree2 = createMerkletree();
    const store = new DataStore();

    // When
    tree1.getRoot.mockReturnValueOnce(SMALL_TREE.root);
    tree1.getLeaves
      .mockReturnValueOnce(SMALL_TREE.leaves)
      .mockReturnValueOnce(SMALL_TREE.leaves);
    tree2.getRoot.mockReturnValueOnce(BIG_TREE.root);
    tree2.getLeaves
      .mockReturnValueOnce(BIG_TREE.leaves)
      .mockReturnValueOnce(BIG_TREE.leaves)
      .mockReturnValueOnce(BIG_TREE.leaves);

    store.addMerkleTree(tree1 as unknown as MerkleTree);
    store.addMerkleTree(tree2 as unknown as MerkleTree);

    // Then
    const index1 = store.getMerkleLeafIndex(
      SMALL_TREE.root,
      SMALL_TREE.leaves[2]!.hash,
    );
    expect(index1.isJust()).toStrictEqual(true);
    expect(index1.unsafeCoerce()).toStrictEqual(2);
    const index2 = store.getMerkleLeafIndex(
      BIG_TREE.root,
      BIG_TREE.leaves[7]!.hash,
    );
    expect(index2.isJust()).toStrictEqual(true);
    expect(index2.unsafeCoerce()).toStrictEqual(7);
    // hash not found in the tree
    const index3 = store.getMerkleLeafIndex(
      BIG_TREE.root,
      SMALL_TREE.leaves[2]!.hash,
    );
    expect(index3.isJust()).toStrictEqual(false);
    // root not found
    const index4 = store.getMerkleLeafIndex(invalidRoot, invalidRoot);
    expect(index4.isJust()).toStrictEqual(false);
  });

  it("Add merkletrees, then get proof", () => {
    // Given
    const invalidRoot = hexaStringToBuffer("deadbeef")!;
    const tree1 = createMerkletree();
    const tree2 = createMerkletree();
    const store = new DataStore();

    // When
    tree1.getRoot.mockReturnValueOnce(SMALL_TREE.root);
    tree1.getLeaves.mockReturnValueOnce(SMALL_TREE.leaves);
    tree1.getLeafHash.mockReturnValueOnce(Just(SMALL_TREE.leaves[1]!.hash));
    tree1.getProof.mockReturnValueOnce(Just(SMALL_TREE.proof));
    tree2.getRoot.mockReturnValueOnce(BIG_TREE.root);
    tree2.getLeaves.mockReturnValueOnce(BIG_TREE.leaves);
    tree2.getLeafHash
      .mockReturnValueOnce(Just(BIG_TREE.leaves[5]!.hash))
      .mockReturnValueOnce(Nothing)
      .mockReturnValueOnce(Just(BIG_TREE.leaves[5]!.hash));
    tree2.getProof
      .mockReturnValueOnce(Just(BIG_TREE.proof))
      .mockReturnValueOnce(Nothing);

    store.addMerkleTree(tree1 as unknown as MerkleTree);
    store.addMerkleTree(tree2 as unknown as MerkleTree);

    // Then
    const proof1 = store.getMerkleProof(SMALL_TREE.root, 1);
    expect(proof1.isJust()).toStrictEqual(true);
    expect(proof1.unsafeCoerce().leafHash).toStrictEqual(
      SMALL_TREE.leaves[1]!.hash,
    );
    expect(proof1.unsafeCoerce().proof).toStrictEqual(SMALL_TREE.proof);
    const proof2 = store.getMerkleProof(BIG_TREE.root, 5);
    expect(proof2.isJust()).toStrictEqual(true);
    expect(proof2.unsafeCoerce().leafHash).toStrictEqual(
      BIG_TREE.leaves[5]!.hash,
    );
    expect(proof2.unsafeCoerce().proof).toStrictEqual(BIG_TREE.proof);
    // getLeafHash returns Nothing
    const proof3 = store.getMerkleProof(BIG_TREE.root, 5);
    expect(proof3.isJust()).toStrictEqual(false);
    // getProof returns Nothing
    const proof4 = store.getMerkleProof(BIG_TREE.root, 5);
    expect(proof4.isJust()).toStrictEqual(false);
    // root not found
    const proof5 = store.getMerkleProof(invalidRoot, 0);
    expect(proof5.isJust()).toStrictEqual(false);
  });
});

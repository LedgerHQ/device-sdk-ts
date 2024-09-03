import { hexaStringToBuffer } from "@ledgerhq/device-sdk-core";
import { Just, Nothing } from "purify-ts";

import { Sha256Hasher } from "@internal/merkle-tree/model/Hasher";

import { DefaultMerkleTree } from "./DefaultMerkleTree";

const EMPTY_TREE = {
  data: [],
  leaves: [],
  nodes: [],
  root: hexaStringToBuffer(
    "0000000000000000000000000000000000000000000000000000000000000000",
  ),
};

const ONE_LEAF_TREE = {
  data: [Uint8Array.from([42, 43])],
  leaves: [Uint8Array.from([0, 42, 43])],
  nodes: [],
  root: hexaStringToBuffer(
    "8a707e40cad3d1070b0a1c87dd362cdf4d546e6d2a7aaf155c798932f71de4ad",
  ),
};

const TINY_TREE = {
  data: [Uint8Array.from([0, 1, 2, 3, 4]), Uint8Array.from([5, 6, 7, 8, 9])],
  leaves: [
    Uint8Array.from([0, 0, 1, 2, 3, 4]),
    Uint8Array.from([0, 5, 6, 7, 8, 9]),
  ],
  nodes: [
    [
      hexaStringToBuffer(
        "9d1cf1e12fa64e20ccd2a5387504b99e89e24ef55dba8399637c3f5b6615c0ad",
      )!,
      hexaStringToBuffer(
        "7dc17a7849e10103f73b8fa5a4b829f6292a1a59272e0e0c9def83a9c0f86de1",
      )!,
    ],
  ],
  root: hexaStringToBuffer(
    "dc65c307a70fb21f4c8ea0cdfc5ff3291adae1db9ce5410b93dcb43c5eddd793",
  )!,
};

const SMALL_TREE = {
  data: [
    Uint8Array.from([0]),
    Uint8Array.from([1]),
    Uint8Array.from([2]),
    Uint8Array.from([3]),
  ],
  leaves: [
    Uint8Array.from([0, 0]),
    Uint8Array.from([0, 1]),
    Uint8Array.from([0, 2]),
    Uint8Array.from([0, 3]),
  ],
  nodes: [
    [
      hexaStringToBuffer(
        "96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7",
      )!,
      hexaStringToBuffer(
        "b413f47d13ee2fe6c845b2ee141af81de858df4ec549a58b7970bb96645bc8d2",
      )!,
      hexaStringToBuffer(
        "fcf0a6c700dd13e274b6fba8deea8dd9b26e4eedde3495717cac8408c9c5177f",
      )!,
      hexaStringToBuffer(
        "583c7dfb7b3055d99465544032a571e10a134b1b6f769422bbb71fd7fa167a5d",
      )!,
    ],
    [
      hexaStringToBuffer(
        "a20bf9a7cc2dc8a08f5f415a71b19f6ac427bab54d24eec868b5d3103449953a",
      )!,
      hexaStringToBuffer(
        "52c56b473e5246933e7852989cd9feba3b38f078742b93afff1e65ed46797825",
      )!,
    ],
  ],
  root: hexaStringToBuffer(
    "9bcd51240af4005168f033121ba85be5a6ed4f0e6a5fac262066729b8fbfdecb",
  )!,
};

const BIG_TREE = {
  data: [
    Uint8Array.from([0]),
    Uint8Array.from([1]),
    Uint8Array.from([2]),
    Uint8Array.from([3]),
    Uint8Array.from([4]),
    Uint8Array.from([5]),
    Uint8Array.from([6]),
    Uint8Array.from([7]),
    Uint8Array.from([8]),
    Uint8Array.from([9]),
    Uint8Array.from([10]),
  ],
  leaves: [
    Uint8Array.from([0, 0]),
    Uint8Array.from([0, 1]),
    Uint8Array.from([0, 2]),
    Uint8Array.from([0, 3]),
    Uint8Array.from([0, 4]),
    Uint8Array.from([0, 5]),
    Uint8Array.from([0, 6]),
    Uint8Array.from([0, 7]),
    Uint8Array.from([0, 8]),
    Uint8Array.from([0, 9]),
    Uint8Array.from([0, 10]),
  ],
  nodes: [
    [
      hexaStringToBuffer(
        "96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7",
      )!,
      hexaStringToBuffer(
        "b413f47d13ee2fe6c845b2ee141af81de858df4ec549a58b7970bb96645bc8d2",
      )!,
      hexaStringToBuffer(
        "fcf0a6c700dd13e274b6fba8deea8dd9b26e4eedde3495717cac8408c9c5177f",
      )!,
      hexaStringToBuffer(
        "583c7dfb7b3055d99465544032a571e10a134b1b6f769422bbb71fd7fa167a5d",
      )!,
      hexaStringToBuffer(
        "4f35212d12f9ad2036492c95f1fe79baf4ec7bd9bef3dffa7579f2293ff546a4",
      )!,
      hexaStringToBuffer(
        "9f1afa4dc124cba73134e82ff50f17c8f7164257c79fed9a13f5943a6acb8e3d",
      )!,
      hexaStringToBuffer(
        "40d88127d4d31a3891f41598eeed41174e5bc89b1eb9bbd66a8cbfc09956a3fd",
      )!,
      hexaStringToBuffer(
        "2ecd8a6b7d2845546659ad4cf443533cf921b19dc81fa83934e83821b4dfdcb7",
      )!,
      hexaStringToBuffer(
        "b4c43b50bf245bd727623e3c775a8fcfb8d823d00b57dd65f7f79dd33f126315",
      )!,
      hexaStringToBuffer(
        "c87479cd656e7e3ad6bd8db402e8027df454b2b0c42ff29e093458beb98a23d4",
      )!,
      hexaStringToBuffer(
        "67ebbd370daa02ba9aadd05d8e091e862d0d8bcadafdf2a22360240a42fe922e",
      )!,
    ],
    [
      hexaStringToBuffer(
        "a20bf9a7cc2dc8a08f5f415a71b19f6ac427bab54d24eec868b5d3103449953a",
      )!,
      hexaStringToBuffer(
        "52c56b473e5246933e7852989cd9feba3b38f078742b93afff1e65ed46797825",
      )!,
      hexaStringToBuffer(
        "4b8c129ed14cce2c08cfc6766db7f8cdb133b5f698b8de3d5890ea7ff7f0a8d1",
      )!,
      hexaStringToBuffer(
        "bbb0feb32f648c73fe170518bcec1f675af1b780dc23d6fbf30b745c1ca5fa11",
      )!,
      hexaStringToBuffer(
        "f7e08e9a9e87822bd79a0bf24d14c7a431be807336bd3c50ccb2d249b2a91404",
      )!,
      hexaStringToBuffer(
        "67ebbd370daa02ba9aadd05d8e091e862d0d8bcadafdf2a22360240a42fe922e",
      )!,
    ],
    [
      hexaStringToBuffer(
        "9bcd51240af4005168f033121ba85be5a6ed4f0e6a5fac262066729b8fbfdecb",
      )!,
      hexaStringToBuffer(
        "c1fe42b33ebb8e8a7e4a90abc481c7434e2be02cff2f6a18d7ffab4f1e25891b",
      )!,
      hexaStringToBuffer(
        "e4b894272eb88bed1830cbef82d1c7aee37612a9e7131a5bdd0ae1a6e8f3ff50",
      )!,
    ],
    [
      hexaStringToBuffer(
        "ef7f49b620f6c7ea9b963a214da34b5021c6ded8ed57734380a311ab726aa907",
      )!,
      hexaStringToBuffer(
        "e4b894272eb88bed1830cbef82d1c7aee37612a9e7131a5bdd0ae1a6e8f3ff50",
      )!,
    ],
  ],
  root: hexaStringToBuffer(
    "e177ad5a8a17108dad67c70a51266681aa02b9e2b7ad6a0357585ba4289982ac",
  )!,
};

describe("DefaultMerkleTree", () => {
  it("Get small tree root and leaves", () => {
    const tree = new DefaultMerkleTree(SMALL_TREE.data, Sha256Hasher);
    expect(tree.getRoot()).toStrictEqual(SMALL_TREE.root);
    expect(tree.size()).toStrictEqual(SMALL_TREE.leaves.length);
    expect(tree.getLeaves().map((l) => l.value)).toStrictEqual(
      SMALL_TREE.leaves,
    );
    expect(tree.getLeaves().map((l) => l.hash)).toStrictEqual(
      SMALL_TREE.nodes[0],
    );
    SMALL_TREE.nodes[0]!.forEach((hash, index) => {
      expect(tree.getLeafHash(index)).toStrictEqual(Just(hash));
    });
    expect(tree.getLeafHash(-1)).toStrictEqual(Nothing);
    expect(tree.getLeafHash(SMALL_TREE.nodes[0]!.length)).toStrictEqual(
      Nothing,
    );
  });

  it("Get big tree root and leaves", () => {
    const tree = new DefaultMerkleTree(BIG_TREE.data, Sha256Hasher);
    expect(tree.getRoot()).toStrictEqual(BIG_TREE.root);
    expect(tree.size()).toStrictEqual(BIG_TREE.leaves.length);
    expect(tree.getLeaves().map((l) => l.value)).toStrictEqual(BIG_TREE.leaves);
    expect(tree.getLeaves().map((l) => l.hash)).toStrictEqual(
      BIG_TREE.nodes[0],
    );
    BIG_TREE.nodes[0]!.forEach((hash, index) => {
      expect(tree.getLeafHash(index)).toStrictEqual(Just(hash));
    });
    expect(tree.getLeafHash(-1)).toStrictEqual(Nothing);
    expect(tree.getLeafHash(BIG_TREE.nodes[0]!.length)).toStrictEqual(Nothing);
  });

  it("Get small tree merkle proof", () => {
    const tree = new DefaultMerkleTree(SMALL_TREE.data, Sha256Hasher);
    const maybeProof = tree.getProof(2);
    expect(maybeProof.isJust()).toStrictEqual(true);
    const proof = maybeProof.unsafeCoerce();

    expect(proof).toStrictEqual([
      SMALL_TREE.nodes[0]![3],
      SMALL_TREE.nodes[1]![0],
    ]);
  });

  it("Get big tree merkle proof", () => {
    const tree = new DefaultMerkleTree(BIG_TREE.data, Sha256Hasher);
    const maybeProof = tree.getProof(2);
    expect(maybeProof.isJust()).toStrictEqual(true);
    const proof = maybeProof.unsafeCoerce();

    expect(proof).toStrictEqual([
      BIG_TREE.nodes[0]![3],
      BIG_TREE.nodes[1]![0],
      BIG_TREE.nodes[2]![1],
      BIG_TREE.nodes[3]![1],
    ]);
  });

  it("Get out-of-bound merkle proof", () => {
    const tree = new DefaultMerkleTree(SMALL_TREE.data, Sha256Hasher);
    let maybeProof = tree.getProof(-1);
    expect(maybeProof.isJust()).toStrictEqual(false);
    maybeProof = tree.getProof(5);
    expect(maybeProof.isJust()).toStrictEqual(false);
  });

  it("Empty tree", () => {
    const tree = new DefaultMerkleTree(EMPTY_TREE.data, Sha256Hasher);
    expect(tree.getRoot()).toStrictEqual(EMPTY_TREE.root);
    const proof = tree.getProof(0);
    expect(proof.isJust()).toStrictEqual(false);
  });

  it("One-leaf tree", () => {
    const tree = new DefaultMerkleTree(ONE_LEAF_TREE.data, Sha256Hasher);
    expect(tree.getRoot()).toStrictEqual(ONE_LEAF_TREE.root);
    const proof = tree.getProof(0);
    expect(proof.isJust()).toStrictEqual(true);
    expect(proof.unsafeCoerce()).toStrictEqual([]);
  });

  it("Tiny tree", () => {
    const tree = new DefaultMerkleTree(TINY_TREE.data, Sha256Hasher);
    expect(tree.getRoot()).toStrictEqual(TINY_TREE.root);
    const proof = tree.getProof(0);
    expect(proof.isJust()).toStrictEqual(true);
    expect(proof.unsafeCoerce()).toStrictEqual([TINY_TREE.nodes[0]![1]]);
  });
});

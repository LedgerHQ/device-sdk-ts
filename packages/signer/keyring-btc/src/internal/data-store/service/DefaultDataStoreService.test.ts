import { Left, Right } from "purify-ts";

import { type DataStore } from "@internal/data-store/model/DataStore";
import { Leaf } from "@internal/merkle-tree/model/Leaf";
import { MerkleTree } from "@internal/merkle-tree/model/MerkleTree";
import { type HasherService } from "@internal/merkle-tree/service/HasherService";
import { type MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { type MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Psbt } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { Wallet } from "@internal/wallet/model/Wallet";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { DefaultDataStoreService } from "./DefaultDataStoreService";

describe("DefaultDataStoreService", () => {
  const mockMerkleMapBuilder = {
    build: jest.fn(),
  };

  const mockMerkleTreeBuilder = {
    build: jest.fn(),
  };

  const mockWalletSerialize = jest.fn();
  const mockWalletSerializer: WalletSerializer = {
    serialize: mockWalletSerialize,
    getId: jest.fn(),
  };

  const mockDataStore = {
    getPreimage: jest.fn(),
    getMerkleLeafIndex: jest.fn(),
    getMerkleProof: jest.fn(),
    addPreimage: jest.fn(),
    addMerkleTree: jest.fn(),
    addMerkleMap: jest.fn(),
  };

  const mockedHash = jest.fn();
  const mockedHasherService: HasherService = {
    hash: mockedHash,
  };

  function createMerkleMap(commitment: number) {
    return {
      getCommitment: () => Uint8Array.from([commitment]),
    };
  }

  function createMerkleTree(root: number) {
    return {
      getRoot: () => Uint8Array.from([root]),
    };
  }

  describe("Merkleize chunks", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it("Success case", () => {
      // Given
      const chunks = [
        Uint8Array.from([0]),
        Uint8Array.from([2]),
        Uint8Array.from([3]),
      ];
      const merkleTree = createMerkleTree(91);
      const storeService = new DefaultDataStoreService(
        mockMerkleTreeBuilder as unknown as MerkleTreeBuilder,
        mockMerkleMapBuilder as unknown as MerkleMapBuilder,
        mockWalletSerializer,
        mockedHasherService,
      );

      // When
      mockMerkleTreeBuilder.build.mockReturnValueOnce(merkleTree);
      const commitment = storeService.merklizeChunks(
        mockDataStore as unknown as DataStore,
        chunks,
      );

      // Then
      expect(mockMerkleTreeBuilder.build).toHaveBeenCalledWith(chunks);
      expect(mockDataStore.addMerkleTree).toHaveBeenCalledWith(merkleTree);
      expect(commitment).toStrictEqual(Uint8Array.from([91]));
    });
  });

  describe("Merkleize wallet", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it("Success case", () => {
      // Given
      const merkleTree = new MerkleTree(
        new Leaf(new Uint8Array(), new Uint8Array(32).fill(7)),
        [],
      );
      const serialized = new Uint8Array(5).fill(6);
      const hash1 = new Uint8Array(5).fill(7);
      const hash2 = new Uint8Array(5).fill(8);
      const wallet = new Wallet({
        name: "Cold storage",
        descriptorTemplate: "template descriptor",
        keys: ["key1", "key2", "key3"],
        hmac: new Uint8Array(),
        keysTree: merkleTree,
        descriptorBuffer: new Uint8Array(32).fill(42),
      });
      const storeService = new DefaultDataStoreService(
        mockMerkleTreeBuilder as unknown as MerkleTreeBuilder,
        mockMerkleMapBuilder as unknown as MerkleMapBuilder,
        mockWalletSerializer,
        mockedHasherService,
      );

      // When
      mockWalletSerialize.mockReturnValueOnce(serialized);
      mockedHash.mockReturnValueOnce(hash1).mockReturnValueOnce(hash2);
      storeService.merklizeWallet(
        mockDataStore as unknown as DataStore,
        wallet,
      );

      // Then
      expect(mockWalletSerialize).toHaveBeenCalledWith(wallet);
      expect(mockedHash).toHaveBeenCalledWith(serialized);
      expect(mockedHash).toHaveBeenCalledWith(wallet.descriptorBuffer);
      expect(mockDataStore.addPreimage).toHaveBeenCalledWith(hash1, serialized);
      expect(mockDataStore.addPreimage).toHaveBeenCalledWith(
        hash2,
        new Uint8Array(32).fill(42),
      );
      expect(mockDataStore.addMerkleTree).toHaveBeenCalledWith(merkleTree);
    });
  });

  describe("Merkleize a PSBT", () => {
    const TEST_PSBT = {
      globalMap: new Map<string, Value>([
        ["02", new Value(Uint8Array.from([2]))],
        ["01", new Value(Uint8Array.from([1]))],
        ["03", new Value(Uint8Array.from([3]))],
      ]),
      inputMaps: [
        new Map<string, Value>([
          ["09", new Value(Uint8Array.from([9]))],
          ["01", new Value(Uint8Array.from([1]))],
          ["07", new Value(Uint8Array.from([7]))],
        ]),
        new Map<string, Value>([
          ["07", new Value(Uint8Array.from([7]))],
          ["03", new Value(Uint8Array.from([3]))],
          ["01", new Value(Uint8Array.from([1]))],
        ]),
      ],
      outputMaps: [
        new Map<string, Value>([
          ["05", new Value(Uint8Array.from([5]))],
          ["06", new Value(Uint8Array.from([6]))],
          ["07", new Value(Uint8Array.from([7]))],
        ]),
      ],
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it("Merkle map service failure", () => {
      // Given
      const storeService = new DefaultDataStoreService(
        mockMerkleTreeBuilder as unknown as MerkleTreeBuilder,
        mockMerkleMapBuilder as unknown as MerkleMapBuilder,
        mockWalletSerializer,
        mockedHasherService,
      );
      const psbt = new Psbt(TEST_PSBT.globalMap, [], []);

      // When
      mockMerkleMapBuilder.build.mockReturnValueOnce(Left(new Error()));
      const commitment = storeService.merklizePsbt(
        mockDataStore as unknown as DataStore,
        psbt,
      );

      // Then
      expect(commitment.isRight()).toStrictEqual(false);
    });

    it("Merkle map service failure on inputs", () => {
      // Given
      const storeService = new DefaultDataStoreService(
        mockMerkleTreeBuilder as unknown as MerkleTreeBuilder,
        mockMerkleMapBuilder as unknown as MerkleMapBuilder,
        mockWalletSerializer,
        mockedHasherService,
      );
      const psbt = new Psbt(TEST_PSBT.globalMap, TEST_PSBT.inputMaps, []);

      // When
      mockMerkleMapBuilder.build
        .mockReturnValueOnce(Right(createMerkleMap(42)))
        .mockReturnValueOnce(Right(createMerkleMap(43)))
        .mockReturnValueOnce(Left(new Error()));
      const commitment = storeService.merklizePsbt(
        mockDataStore as unknown as DataStore,
        psbt,
      );

      // Then
      expect(commitment.isRight()).toStrictEqual(false);
    });

    it("Merkle map service failure on outputs", () => {
      // Given
      const storeService = new DefaultDataStoreService(
        mockMerkleTreeBuilder as unknown as MerkleTreeBuilder,
        mockMerkleMapBuilder as unknown as MerkleMapBuilder,
        mockWalletSerializer,
        mockedHasherService,
      );

      // When
      const psbt = new Psbt(
        TEST_PSBT.globalMap,
        TEST_PSBT.inputMaps,
        TEST_PSBT.outputMaps,
      );
      mockMerkleMapBuilder.build
        .mockReturnValueOnce(Right(createMerkleMap(42)))
        .mockReturnValueOnce(Right(createMerkleMap(43)))
        .mockReturnValueOnce(Right(createMerkleMap(44)))
        .mockReturnValueOnce(Left(new Error()));
      const commitment = storeService.merklizePsbt(
        mockDataStore as unknown as DataStore,
        psbt,
      );

      // Then
      expect(commitment.isRight()).toStrictEqual(false);
    });

    it("Maps should be ordered", () => {
      // Given
      const storeService = new DefaultDataStoreService(
        mockMerkleTreeBuilder as unknown as MerkleTreeBuilder,
        mockMerkleMapBuilder as unknown as MerkleMapBuilder,
        mockWalletSerializer,
        mockedHasherService,
      );
      const psbt = new Psbt(
        TEST_PSBT.globalMap,
        TEST_PSBT.inputMaps,
        TEST_PSBT.outputMaps,
      );

      // When
      mockMerkleMapBuilder.build.mockReturnValue(Left(new Error()));
      storeService.merklizePsbt(mockDataStore as unknown as DataStore, psbt);

      // Then
      expect(mockMerkleMapBuilder.build).toHaveBeenCalledWith(
        [Uint8Array.from([1]), Uint8Array.from([2]), Uint8Array.from([3])],
        [Uint8Array.from([1]), Uint8Array.from([2]), Uint8Array.from([3])],
      );
      expect(mockMerkleMapBuilder.build).toHaveBeenCalledWith(
        [Uint8Array.from([1]), Uint8Array.from([7]), Uint8Array.from([9])],
        [Uint8Array.from([1]), Uint8Array.from([7]), Uint8Array.from([9])],
      );
      expect(mockMerkleMapBuilder.build).toHaveBeenCalledWith(
        [Uint8Array.from([1]), Uint8Array.from([3]), Uint8Array.from([7])],
        [Uint8Array.from([1]), Uint8Array.from([3]), Uint8Array.from([7])],
      );
      expect(mockMerkleMapBuilder.build).toHaveBeenCalledWith(
        [Uint8Array.from([5]), Uint8Array.from([6]), Uint8Array.from([7])],
        [Uint8Array.from([5]), Uint8Array.from([6]), Uint8Array.from([7])],
      );
    });

    it("Success case", () => {
      // Given
      const merkleMap1 = createMerkleMap(42);
      const merkleMap2 = createMerkleMap(43);
      const merkleMap3 = createMerkleMap(44);
      const merkleMap4 = createMerkleMap(45);
      const merkleTree1 = createMerkleTree(91);
      const merkleTree2 = createMerkleTree(92);
      const storeService = new DefaultDataStoreService(
        mockMerkleTreeBuilder as unknown as MerkleTreeBuilder,
        mockMerkleMapBuilder as unknown as MerkleMapBuilder,
        mockWalletSerializer,
        mockedHasherService,
      );
      const psbt = new Psbt(
        TEST_PSBT.globalMap,
        TEST_PSBT.inputMaps,
        TEST_PSBT.outputMaps,
      );

      // When
      mockMerkleMapBuilder.build
        .mockReturnValueOnce(Right(merkleMap1))
        .mockReturnValueOnce(Right(merkleMap2))
        .mockReturnValueOnce(Right(merkleMap3))
        .mockReturnValueOnce(Right(merkleMap4));
      mockMerkleTreeBuilder.build
        .mockReturnValueOnce(merkleTree1)
        .mockReturnValueOnce(merkleTree2);
      const commitment = storeService.merklizePsbt(
        mockDataStore as unknown as DataStore,
        psbt,
      );

      // Then
      expect(mockDataStore.addMerkleMap).toHaveBeenCalledWith(merkleMap1);
      expect(mockDataStore.addMerkleMap).toHaveBeenCalledWith(merkleMap2);
      expect(mockDataStore.addMerkleMap).toHaveBeenCalledWith(merkleMap3);
      expect(mockDataStore.addMerkleMap).toHaveBeenCalledWith(merkleMap4);
      expect(mockDataStore.addMerkleTree).toHaveBeenCalledWith(merkleTree1);
      expect(mockDataStore.addMerkleTree).toHaveBeenCalledWith(merkleTree2);
      expect(mockMerkleTreeBuilder.build).toHaveBeenCalledWith([
        Uint8Array.from([43]),
        Uint8Array.from([44]),
      ]);
      expect(mockMerkleTreeBuilder.build).toHaveBeenCalledWith([
        Uint8Array.from([45]),
      ]);
      expect(commitment.isRight()).toStrictEqual(true);
      expect(commitment.unsafeCoerce()).toStrictEqual({
        globalCommitment: Uint8Array.from([42]),
        inputsRoot: Uint8Array.from([91]),
        outputsRoot: Uint8Array.from([92]),
      });
    });
  });
});

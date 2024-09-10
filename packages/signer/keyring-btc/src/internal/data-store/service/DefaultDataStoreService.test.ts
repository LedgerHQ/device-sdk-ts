import { Left, Right } from "purify-ts";

import { DataStore } from "@internal/data-store/model/DataStore";
import { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Psbt } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";

import { DefaultDataStoreService } from "./DefaultDataStoreService";

describe("DefaultDataStoreService", () => {
  const mockMerkleMapBuilder = {
    build: jest.fn(),
  };

  const mockMerkleTreeBuilder = {
    build: jest.fn(),
  };

  const mockDataStore = {
    getPreimage: jest.fn(),
    getMerkleLeafIndex: jest.fn(),
    getMerkleProof: jest.fn(),
    addPreimage: jest.fn(),
    addMerkleTree: jest.fn(),
    addMerkleMap: jest.fn(),
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

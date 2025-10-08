import { Left, Right } from "purify-ts";

import { type NftDataSource } from "@/nft/data/NftDataSource";
import { NftContextFieldLoader } from "@/nft/domain/NftContextFieldLoader";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

describe("NftContextFieldLoader", () => {
  const mockNftDataSource: NftDataSource = {
    getNftInfosPayload: vi.fn(),
    getSetPluginPayload: vi.fn(),
  };
  const nftContextFieldLoader = new NftContextFieldLoader(mockNftDataSource);

  const mockTransactionField = {
    chainId: 1,
    address: "0x1234567890abcdef",
  };

  const mockNftPayload = "0x123456789abcdef0";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("canHandle", () => {
    it("should return true for valid NFT field", () => {
      // GIVEN
      const validField = {
        chainId: 1,
        address: "0x1234567890abcdef",
      };

      // THEN
      expect(
        nftContextFieldLoader.canHandle(validField, ClearSignContextType.NFT),
      ).toBe(true);
    });

    describe("should return false for invalid fields", () => {
      const invalidFields = [
        { name: "null", value: null },
        { name: "undefined", value: undefined },
        { name: "string", value: "invalid" },
        { name: "number", value: 123 },
        { name: "boolean", value: true },
        { name: "array", value: [] },
        { name: "empty object", value: {} },
        {
          name: "object missing chainId",
          value: { address: "0x123" },
        },
        {
          name: "object missing address",
          value: { chainId: 1 },
        },
      ];

      test.each(invalidFields)("$name", ({ value }) => {
        expect(
          nftContextFieldLoader.canHandle(value, ClearSignContextType.NFT),
        ).toBe(false);
      });
    });

    it("should return false for invalid expected type", () => {
      expect(
        nftContextFieldLoader.canHandle(
          mockTransactionField,
          ClearSignContextType.TOKEN,
        ),
      ).toBe(false);
    });
  });

  describe("loadField", () => {
    it("should return error context when NFT data source fails", async () => {
      // GIVEN
      const error = new Error("NFT data source error");
      vi.spyOn(mockNftDataSource, "getNftInfosPayload").mockResolvedValue(
        Left(error),
      );

      // WHEN
      const result =
        await nftContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockNftDataSource.getNftInfosPayload).toHaveBeenCalledWith({
        address: mockTransactionField.address,
        chainId: mockTransactionField.chainId,
      });
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: error,
      });
    });

    it("should return NFT context when successful", async () => {
      // GIVEN
      vi.spyOn(mockNftDataSource, "getNftInfosPayload").mockResolvedValue(
        Right(mockNftPayload),
      );

      // WHEN
      const result =
        await nftContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockNftDataSource.getNftInfosPayload).toHaveBeenCalledWith({
        address: mockTransactionField.address,
        chainId: mockTransactionField.chainId,
      });
      expect(result).toEqual({
        type: ClearSignContextType.NFT,
        payload: mockNftPayload,
      });
    });

    it("should handle different chain IDs and addresses correctly", async () => {
      // GIVEN
      const customField = {
        ...mockTransactionField,
        chainId: 137,
        address: "0xdeadbeef",
      };
      vi.spyOn(mockNftDataSource, "getNftInfosPayload").mockResolvedValue(
        Right(mockNftPayload),
      );

      // WHEN
      const result = await nftContextFieldLoader.loadField(customField);

      // THEN
      expect(mockNftDataSource.getNftInfosPayload).toHaveBeenCalledWith({
        address: "0xdeadbeef",
        chainId: 137,
      });
      expect(result).toEqual({
        type: ClearSignContextType.NFT,
        payload: mockNftPayload,
      });
    });

    it("should preserve error message from NFT data source", async () => {
      // GIVEN
      const specificError = new Error("Network timeout error");
      vi.spyOn(mockNftDataSource, "getNftInfosPayload").mockResolvedValue(
        Left(specificError),
      );

      // WHEN
      const result =
        await nftContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: specificError,
      });
    });

    it("should handle empty NFT payload", async () => {
      // GIVEN
      const emptyPayload = "";
      vi.spyOn(mockNftDataSource, "getNftInfosPayload").mockResolvedValue(
        Right(emptyPayload),
      );

      // WHEN
      const result =
        await nftContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.NFT,
        payload: emptyPayload,
      });
    });
  });
});

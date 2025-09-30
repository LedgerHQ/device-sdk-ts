import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { TokenContextFieldLoader } from "@/token/domain/TokenContextFieldLoader";

describe("TokenContextFieldLoader", () => {
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: vi.fn(),
  };
  const tokenContextFieldLoader = new TokenContextFieldLoader(
    mockTokenDataSource,
  );

  const mockTransactionField = {
    kind: "TOKEN",
    chainId: 1,
    address: "0x1234567890abcdef",
  };

  const mockTokenPayload = "0x123456789abcdef0";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("canHandle", () => {
    it("should return true for valid token field", () => {
      // GIVEN
      const validField = {
        kind: "TOKEN",
        chainId: 1,
        address: "0x1234567890abcdef",
      };

      // THEN
      expect(
        tokenContextFieldLoader.canHandle(
          validField,
          ClearSignContextType.TOKEN,
        ),
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
          value: { kind: "TOKEN", address: "0x123" },
        },
        {
          name: "object missing address",
          value: { kind: "TOKEN", chainId: 1 },
        },
      ];

      test.each(invalidFields)("$name", ({ value }) => {
        expect(
          tokenContextFieldLoader.canHandle(value, ClearSignContextType.TOKEN),
        ).toBe(false);
      });
    });

    it("should return false for invalid expected type", () => {
      expect(
        tokenContextFieldLoader.canHandle(
          mockTransactionField,
          ClearSignContextType.NFT,
        ),
      ).toBe(false);
    });
  });

  describe("loadField", () => {
    it("should return error context when token data source fails", async () => {
      // GIVEN
      const error = new Error("Token data source error");
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(error),
      );

      // WHEN
      const result =
        await tokenContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockTokenDataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        address: mockTransactionField.address,
        chainId: mockTransactionField.chainId,
      });
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: error,
      });
    });

    it("should return token context when successful", async () => {
      // GIVEN
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(mockTokenPayload),
      );

      // WHEN
      const result =
        await tokenContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockTokenDataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        address: mockTransactionField.address,
        chainId: mockTransactionField.chainId,
      });
      expect(result).toEqual({
        type: ClearSignContextType.TOKEN,
        payload: mockTokenPayload,
      });
    });

    it("should handle different chain IDs and addresses correctly", async () => {
      // GIVEN
      const customField = {
        ...mockTransactionField,
        chainId: 137,
        address: "0xdeadbeef",
      };
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(mockTokenPayload),
      );

      // WHEN
      const result = await tokenContextFieldLoader.loadField(customField);

      // THEN
      expect(mockTokenDataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        address: "0xdeadbeef",
        chainId: 137,
      });
      expect(result).toEqual({
        type: ClearSignContextType.TOKEN,
        payload: mockTokenPayload,
      });
    });

    it("should preserve error message from token data source", async () => {
      // GIVEN
      const specificError = new Error("Network timeout error");
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(specificError),
      );

      // WHEN
      const result =
        await tokenContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: specificError,
      });
    });

    it("should handle empty token payload", async () => {
      // GIVEN
      const emptyPayload = "";
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(emptyPayload),
      );

      // WHEN
      const result =
        await tokenContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.TOKEN,
        payload: emptyPayload,
      });
    });
  });
});

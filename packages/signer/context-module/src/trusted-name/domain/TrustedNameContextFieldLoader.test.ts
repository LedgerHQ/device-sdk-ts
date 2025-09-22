import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { TrustedNameContextFieldLoader } from "@/trusted-name/domain/TrustedNameContextFieldLoader";

describe("TrustedNameContextFieldLoader", () => {
  const mockTrustedNameDataSource: TrustedNameDataSource = {
    getTrustedNamePayload: vi.fn(),
    getDomainNamePayload: vi.fn(),
  };
  const trustedNameContextFieldLoader = new TrustedNameContextFieldLoader(
    mockTrustedNameDataSource,
  );

  const mockTransactionField = {
    chainId: 1,
    address: "0x1234567890abcdef",
    challenge: "test-challenge",
    types: ["contract", "token"],
    sources: ["ledger", "ens"],
  };

  const mockTrustedNamePayload = "0x123456789abcdef0";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("canHandle", () => {
    it("should return true for valid trusted name field", () => {
      // GIVEN
      const validField = {
        chainId: 1,
        address: "0x1234567890abcdef",
        challenge: "test-challenge",
        types: ["contract", "token"],
        sources: ["ledger", "ens"],
      };

      // THEN
      expect(
        trustedNameContextFieldLoader.canHandle(
          validField,
          ClearSignContextType.TRUSTED_NAME,
        ),
      ).toBe(true);
    });

    describe("should return false for invalid inputs", () => {
      const invalidInputs = [
        { name: "null", value: null },
        { name: "undefined", value: undefined },
        { name: "string", value: "invalid" },
        { name: "number", value: 123 },
        { name: "boolean", value: true },
        { name: "array", value: [] },
        { name: "empty object", value: {} },
        {
          name: "object missing chainId",
          value: {
            address: "0x123",
            challenge: "test",
            types: ["contract"],
            sources: ["ledger"],
          },
        },
        {
          name: "object missing address",
          value: {
            chainId: 1,
            challenge: "test",
            types: ["contract"],
            sources: ["ledger"],
          },
        },
        {
          name: "object missing challenge",
          value: {
            chainId: 1,
            address: "0x123",
            types: ["contract"],
            sources: ["ledger"],
          },
        },
        {
          name: "object missing types",
          value: {
            chainId: 1,
            address: "0x123",
            challenge: "test",
            sources: ["ledger"],
          },
        },
        {
          name: "object missing sources",
          value: {
            chainId: 1,
            address: "0x123",
            challenge: "test",
            types: ["contract"],
          },
        },
      ];

      test.each(invalidInputs)("$name", ({ value }) => {
        expect(
          trustedNameContextFieldLoader.canHandle(
            value,
            ClearSignContextType.TRUSTED_NAME,
          ),
        ).toBe(false);
      });
    });

    it("should return false for invalid expected type", () => {
      expect(
        trustedNameContextFieldLoader.canHandle(
          mockTransactionField,
          ClearSignContextType.TOKEN,
        ),
      ).toBe(false);
    });
  });

  describe("loadField", () => {
    it("should return error context when trusted name data source fails", async () => {
      // GIVEN
      const error = new Error("Trusted name data source error");
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Left(error));

      // WHEN
      const result =
        await trustedNameContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(
        mockTrustedNameDataSource.getTrustedNamePayload,
      ).toHaveBeenCalledWith({
        chainId: mockTransactionField.chainId,
        address: mockTransactionField.address,
        challenge: mockTransactionField.challenge,
        types: mockTransactionField.types,
        sources: mockTransactionField.sources,
      });
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: error,
      });
    });

    it("should return trusted name context when successful", async () => {
      // GIVEN
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Right(mockTrustedNamePayload));

      // WHEN
      const result =
        await trustedNameContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(
        mockTrustedNameDataSource.getTrustedNamePayload,
      ).toHaveBeenCalledWith({
        chainId: mockTransactionField.chainId,
        address: mockTransactionField.address,
        challenge: mockTransactionField.challenge,
        types: mockTransactionField.types,
        sources: mockTransactionField.sources,
      });
      expect(result).toEqual({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: mockTrustedNamePayload,
      });
    });

    it("should handle different chain IDs and addresses correctly", async () => {
      // GIVEN
      const customField = {
        ...mockTransactionField,
        chainId: 137,
        address: "0xdeadbeef",
        challenge: "custom-challenge",
      };
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Right(mockTrustedNamePayload));

      // WHEN
      const result = await trustedNameContextFieldLoader.loadField(customField);

      // THEN
      expect(
        mockTrustedNameDataSource.getTrustedNamePayload,
      ).toHaveBeenCalledWith({
        chainId: 137,
        address: "0xdeadbeef",
        challenge: "custom-challenge",
        types: mockTransactionField.types,
        sources: mockTransactionField.sources,
      });
      expect(result).toEqual({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: mockTrustedNamePayload,
      });
    });

    it("should handle different types and sources correctly", async () => {
      // GIVEN
      const customField = {
        ...mockTransactionField,
        types: ["wallet", "exchange"],
        sources: ["coingecko", "1inch"],
      };
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Right(mockTrustedNamePayload));

      // WHEN
      const result = await trustedNameContextFieldLoader.loadField(customField);

      // THEN
      expect(
        mockTrustedNameDataSource.getTrustedNamePayload,
      ).toHaveBeenCalledWith({
        chainId: mockTransactionField.chainId,
        address: mockTransactionField.address,
        challenge: mockTransactionField.challenge,
        types: ["wallet", "exchange"],
        sources: ["coingecko", "1inch"],
      });
      expect(result).toEqual({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: mockTrustedNamePayload,
      });
    });

    it("should preserve error message from trusted name data source", async () => {
      // GIVEN
      const specificError = new Error("Network timeout error");
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Left(specificError));

      // WHEN
      const result =
        await trustedNameContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: specificError,
      });
    });

    it("should handle empty trusted name payload", async () => {
      // GIVEN
      const emptyPayload = "";
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Right(emptyPayload));

      // WHEN
      const result =
        await trustedNameContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: emptyPayload,
      });
    });

    it("should handle empty types and sources arrays", async () => {
      // GIVEN
      const fieldWithEmptyArrays = {
        ...mockTransactionField,
        types: [],
        sources: [],
      };
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Right(mockTrustedNamePayload));

      // WHEN
      const result =
        await trustedNameContextFieldLoader.loadField(fieldWithEmptyArrays);

      // THEN
      expect(
        mockTrustedNameDataSource.getTrustedNamePayload,
      ).toHaveBeenCalledWith({
        chainId: mockTransactionField.chainId,
        address: mockTransactionField.address,
        challenge: mockTransactionField.challenge,
        types: [],
        sources: [],
      });
      expect(result).toEqual({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: mockTrustedNamePayload,
      });
    });

    it("should handle single type and source", async () => {
      // GIVEN
      const fieldWithSingleElements = {
        ...mockTransactionField,
        types: ["contract"],
        sources: ["ens"],
      };
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Right(mockTrustedNamePayload));

      // WHEN
      const result = await trustedNameContextFieldLoader.loadField(
        fieldWithSingleElements,
      );

      // THEN
      expect(
        mockTrustedNameDataSource.getTrustedNamePayload,
      ).toHaveBeenCalledWith({
        chainId: mockTransactionField.chainId,
        address: mockTransactionField.address,
        challenge: mockTransactionField.challenge,
        types: ["contract"],
        sources: ["ens"],
      });
      expect(result).toEqual({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: mockTrustedNamePayload,
      });
    });
  });
});

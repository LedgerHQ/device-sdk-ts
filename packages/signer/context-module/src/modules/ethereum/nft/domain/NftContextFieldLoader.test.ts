import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type NftDataSource } from "@/modules/ethereum/nft/data/NftDataSource";
import { NftContextFieldLoader } from "@/modules/ethereum/nft/domain/NftContextFieldLoader";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

describe("NftContextFieldLoader", () => {
  const mockNftDataSource: NftDataSource = {
    getNftInfosPayload: vi.fn(),
    getSetPluginPayload: vi.fn(),
  };
  const loadCertificateMock = vi.fn();
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: loadCertificateMock,
  };
  const nftContextFieldLoader = new NftContextFieldLoader(
    mockNftDataSource,
    mockCertificateLoader,
  );

  const mockTransactionField = {
    chainId: 1,
    address: "0x1234567890abcdef",
    deviceModelId: DeviceModelId.STAX,
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
        deviceModelId: DeviceModelId.STAX,
      };

      // THEN
      expect(
        nftContextFieldLoader.canHandle(
          validField,
          ClearSignContextType.ETHEREUM_NFT,
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
          value: { address: "0x123" },
        },
        {
          name: "object missing address",
          value: { chainId: 1 },
        },
        {
          name: "object missing deviceModelId",
          value: { chainId: 1, address: "0x123" },
        },
      ];

      test.each(invalidFields)("$name", ({ value }) => {
        expect(
          nftContextFieldLoader.canHandle(
            value,
            ClearSignContextType.ETHEREUM_NFT,
          ),
        ).toBe(false);
      });
    });

    it("should return false for invalid expected type", () => {
      expect(
        nftContextFieldLoader.canHandle(
          mockTransactionField,
          ClearSignContextType.ETHEREUM_TOKEN,
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

    it("should return NFT context with its certificate when successful", async () => {
      // GIVEN
      const certificate = {
        keyUsageNumber: 3,
        payload: new Uint8Array([0x03]),
      };
      vi.spyOn(mockNftDataSource, "getNftInfosPayload").mockResolvedValue(
        Right(mockNftPayload),
      );
      loadCertificateMock.mockResolvedValue(certificate);

      // WHEN
      const result =
        await nftContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockNftDataSource.getNftInfosPayload).toHaveBeenCalledWith({
        address: mockTransactionField.address,
        chainId: mockTransactionField.chainId,
      });
      expect(loadCertificateMock).toHaveBeenCalledWith({
        keyId: KeyId.NftMetadataKey,
        keyUsage: KeyUsage.NftMeta,
        targetDevice: DeviceModelId.STAX,
      });
      expect(result).toEqual({
        type: ClearSignContextType.ETHEREUM_NFT,
        payload: mockNftPayload,
        certificate,
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
        type: ClearSignContextType.ETHEREUM_NFT,
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
        type: ClearSignContextType.ETHEREUM_NFT,
        payload: emptyPayload,
      });
    });
  });
});

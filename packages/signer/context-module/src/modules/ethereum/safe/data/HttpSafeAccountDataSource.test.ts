import {
  type DmkNetworkClient,
  type HexaString,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { HttpSafeAccountDataSource } from "@/modules/ethereum/safe/data/HttpSafeAccountDataSource";

describe("HttpSafeAccountDataSource", () => {
  const config: ContextModuleServiceConfig = {
    metadataServiceDomain: {
      url: "https://metadata.ledger.com",
    },
    originToken: "test-origin-token",
  } as ContextModuleServiceConfig;

  const validSafeAccountDto = {
    accountDescriptor: {
      signedDescriptor: "account-signed-descriptor-data",
      keyId: "account-key-id",
      keyUsage: "account-key-usage",
    },
    signersDescriptor: {
      signedDescriptor: "signers-signed-descriptor-data",
      keyId: "signers-key-id",
      keyUsage: "signers-key-usage",
    },
  };

  const validsafeContractAddress: HexaString =
    "0x1234567890123456789012345678901234567890";

  let httpMock: { get: ReturnType<typeof vi.fn> };
  let datasource: HttpSafeAccountDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpSafeAccountDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("getDescriptors", () => {
    it("should return safe account descriptors on successful request", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue(validSafeAccountDto);

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        "https://metadata.ledger.com/v2/ethereum/1/safe/account/0x1234567890123456789012345678901234567890",
        { params: { challenge: "0xabcdef" } },
      );
      expect(result).toEqual(
        Right({
          account: {
            signedDescriptor: "account-signed-descriptor-data",
            keyId: "account-key-id",
            keyUsage: "account-key-usage",
          },
          signers: {
            signedDescriptor: "signers-signed-descriptor-data",
            keyId: "signers-key-id",
            keyUsage: "signers-key-usage",
          },
        }),
      );
    });

    it("should work with different chain IDs", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 137, // Polygon
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue(validSafeAccountDto);

      // WHEN
      await datasource.getDescriptors(params);

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        "https://metadata.ledger.com/v2/ethereum/137/safe/account/0x1234567890123456789012345678901234567890",
        { params: { challenge: "0xabcdef" } },
      );
    });

    it("should work with different safe addresses", async () => {
      // GIVEN
      const params = {
        safeContractAddress:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as HexaString,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue(validSafeAccountDto);

      // WHEN
      await datasource.getDescriptors(params);

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        "https://metadata.ledger.com/v2/ethereum/1/safe/account/0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        { params: { challenge: "0xabcdef" } },
      );
    });

    it("should work with different challenges", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0x123456789",
      };
      httpMock.get.mockResolvedValue(validSafeAccountDto);

      // WHEN
      await datasource.getDescriptors(params);

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(expect.any(String), {
        params: { challenge: "0x123456789" },
      });
    });

    it("should return error when response data is empty", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue(null);

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: unexpected empty response",
          ),
        ),
      );
    });

    it("should return error when response data is undefined", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue(undefined);

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: unexpected empty response",
          ),
        ),
      );
    });

    it("should return error when accountDescriptor is missing", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        signersDescriptor: validSafeAccountDto.signersDescriptor,
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when signersDescriptor is missing", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: validSafeAccountDto.accountDescriptor,
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when accountDescriptor.signedDescriptor is missing", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: {
          keyId: "account-key-id",
          keyUsage: "account-key-usage",
        },
        signersDescriptor: validSafeAccountDto.signersDescriptor,
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when accountDescriptor.keyId is missing", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: {
          signedDescriptor: "account-signed-descriptor-data",
          keyUsage: "account-key-usage",
        },
        signersDescriptor: validSafeAccountDto.signersDescriptor,
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when accountDescriptor.keyUsage is missing", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: {
          signedDescriptor: "account-signed-descriptor-data",
          keyId: "account-key-id",
        },
        signersDescriptor: validSafeAccountDto.signersDescriptor,
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when signersDescriptor fields are invalid", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: validSafeAccountDto.accountDescriptor,
        signersDescriptor: {
          signedDescriptor: "signers-signed-descriptor-data",
          keyId: 123, // wrong type
          keyUsage: "signers-key-usage",
        },
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when accountDescriptor is not an object", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: "invalid-string",
        signersDescriptor: validSafeAccountDto.signersDescriptor,
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when signersDescriptor is not an object", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: validSafeAccountDto.accountDescriptor,
        signersDescriptor: null,
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when network client rejects", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockRejectedValue(new Error("Network error"));

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: Failed to fetch safe account descriptors",
          ),
        ),
      );
    });

    it("should return error when network client throws an exception", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockRejectedValue(new Error("timeout"));

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: Failed to fetch safe account descriptors",
          ),
        ),
      );
    });

    it("should handle empty string values in descriptors", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: {
          signedDescriptor: "",
          keyId: "",
          keyUsage: "",
        },
        signersDescriptor: {
          signedDescriptor: "",
          keyId: "",
          keyUsage: "",
        },
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Right({
          account: {
            signedDescriptor: "",
            keyId: "",
            keyUsage: "",
          },
          signers: {
            signedDescriptor: "",
            keyId: "",
            keyUsage: "",
          },
        }),
      );
    });

    it("should correctly parse response with long descriptor values", async () => {
      // GIVEN
      const longValue = "a".repeat(1000);
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue({
        accountDescriptor: {
          signedDescriptor: longValue,
          keyId: "account-key-id",
          keyUsage: "account-key-usage",
        },
        signersDescriptor: {
          signedDescriptor: longValue,
          keyId: "signers-key-id",
          keyUsage: "signers-key-usage",
        },
      });

      // WHEN
      const result = await datasource.getDescriptors(params);

      // THEN
      expect(result).toEqual(
        Right({
          account: {
            signedDescriptor: longValue,
            keyId: "account-key-id",
            keyUsage: "account-key-usage",
          },
          signers: {
            signedDescriptor: longValue,
            keyId: "signers-key-id",
            keyUsage: "signers-key-usage",
          },
        }),
      );
    });

    it("should use correct metadata service URL from config", async () => {
      // GIVEN
      const customConfig: ContextModuleServiceConfig = {
        metadataServiceDomain: {
          url: "https://custom-metadata.example.com",
        },
        originToken: "test-token",
      } as ContextModuleServiceConfig;
      const customDatasource = new HttpSafeAccountDataSource(
        customConfig,
        httpMock as unknown as DmkNetworkClient,
      );
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      httpMock.get.mockResolvedValue(validSafeAccountDto);

      // WHEN
      await customDatasource.getDescriptors(params);

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        "https://custom-metadata.example.com/v2/ethereum/1/safe/account/0x1234567890123456789012345678901234567890",
        { params: { challenge: "0xabcdef" } },
      );
    });
  });
});

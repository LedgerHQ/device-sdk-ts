import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { type SafeProxyImplementationAddressDto } from "./dto/SafeProxyImplementationAddressDto";
import { HttpSafeProxyDataSource } from "./HttpSafeProxyDataSource";
import { type ProxyDataSource } from "./ProxyDataSource";

const config = {
  metadataServiceDomain: {
    url: "https://metadata.api.live.ledger.com",
  },
  originToken: "test-origin-token",
} as ContextModuleServiceConfig;

describe("HttpSafeProxyDataSource", () => {
  let datasource: ProxyDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpSafeProxyDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  const validParams = {
    proxyAddress: "0x1234567890123456789012345678901234567890",
    chainId: 1,
    challenge: "test-challenge",
    calldata: "0xabcdef",
  };

  const validDto: SafeProxyImplementationAddressDto = {
    proxyAddress: "0x1234567890123456789012345678901234567890",
    implementationAddress: "0x9876543210987654321098765432109876543210",
    standard: "EIP-1967",
    signedDescriptor: "signed-descriptor-data",
    providedBy: "SAFE_GATEWAY",
    keyId: "testKeyId",
    keyUsage: "testKeyUsage",
  };

  describe("getProxyImplementationAddress", () => {
    it("should call the network client with correct URL and parameters", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue(validDto);

      // WHEN
      await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v3/ethereum/${validParams.chainId}/contract/proxy/${validParams.proxyAddress}`,
        {
          params: {
            challenge: validParams.challenge,
            resolver: "SAFE_GATEWAY",
          },
        },
      );
    });

    it("should return Right with proxy implementation data when request succeeds with valid DTO", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue(validDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isRight()).toBe(true);
      expect(result.extract()).toEqual({
        implementationAddress: validDto.implementationAddress,
        signedDescriptor: validDto.signedDescriptor,
        keyId: "testKeyId",
        keyUsage: "testKeyUsage",
      });
    });

    it("should return Left with error when network client throws", async () => {
      // GIVEN
      httpMock.get.mockRejectedValue(new Error("Network error"));

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpSafeProxyDataSource: Failed to fetch safe proxy implementation",
        ),
      );
    });

    it("should return Left with error when response data is undefined", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue(undefined);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when response data is null", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue(null);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when proxyAddress is missing", async () => {
      // GIVEN
      const { proxyAddress: _, ...invalidDto } = validDto;
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when implementationAddress is missing", async () => {
      // GIVEN
      const { implementationAddress: _, ...invalidDto } = validDto;
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when standard is missing", async () => {
      // GIVEN
      const { standard: _, ...invalidDto } = validDto;
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when signedDescriptor is missing", async () => {
      // GIVEN
      const { signedDescriptor: _, ...invalidDto } = validDto;
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when providedBy is missing", async () => {
      // GIVEN
      const { providedBy: _, ...invalidDto } = validDto;
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when proxyAddress is not a string", async () => {
      // GIVEN
      const invalidDto = { ...validDto, proxyAddress: 123 };
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when implementationAddress is not a string", async () => {
      // GIVEN
      const invalidDto = { ...validDto, implementationAddress: null };
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when standard is not a string", async () => {
      // GIVEN
      const invalidDto = { ...validDto, standard: [] };
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when signedDescriptor is not a string", async () => {
      // GIVEN
      const invalidDto = { ...validDto, signedDescriptor: {} };
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when providedBy is not a string", async () => {
      // GIVEN
      const invalidDto = { ...validDto, providedBy: true };
      httpMock.get.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when response is not an object", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue("not an object");

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when response is null", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue(null);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should handle different chainId values correctly", async () => {
      // GIVEN
      const paramsWithDifferentChainId = { ...validParams, chainId: 137 };
      httpMock.get.mockResolvedValue(validDto);

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentChainId,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(httpMock.get).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v3/ethereum/137/contract/proxy/${validParams.proxyAddress}`,
        expect.anything(),
      );
    });

    it("should handle different proxy addresses correctly", async () => {
      // GIVEN
      const differentProxyAddress =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      const paramsWithDifferentAddress = {
        ...validParams,
        proxyAddress: differentProxyAddress,
      };
      httpMock.get.mockResolvedValue(validDto);

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentAddress,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(httpMock.get).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v3/ethereum/${validParams.chainId}/contract/proxy/${differentProxyAddress}`,
        expect.anything(),
      );
    });

    it("should pass challenge parameter correctly", async () => {
      // GIVEN
      const customChallenge = "custom-challenge-string";
      const paramsWithCustomChallenge = {
        ...validParams,
        challenge: customChallenge,
      };
      httpMock.get.mockResolvedValue(validDto);

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomChallenge,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(httpMock.get).toHaveBeenCalledWith(expect.any(String), {
        params: { challenge: customChallenge, resolver: "SAFE_GATEWAY" },
      });
    });
  });
});

import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { KeyId } from "@/chain-agnostic-loaders/pki/model/KeyId";
import { KeyUsage } from "@/chain-agnostic-loaders/pki/model/KeyUsage";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { type ProxyDelegateCallDto } from "./dto/ProxyDelegateCallDto";
import { HttpProxyDataSource } from "./HttpProxyDataSource";
import { type ProxyDataSource } from "./ProxyDataSource";

const config = {
  metadataServiceDomain: {
    url: "https://metadata.api.live.ledger.com",
  },
  originToken: "test-origin-token",
} as ContextModuleServiceConfig;

describe("HttpProxyDataSource", () => {
  let datasource: ProxyDataSource;
  let httpMock: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { post: vi.fn() };
    datasource = new HttpProxyDataSource(
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

  const validDto: ProxyDelegateCallDto = {
    addresses: ["0x9876543210987654321098765432109876543210"],
    signedDescriptor: "signed-descriptor-data",
  };

  describe("getProxyImplementationAddress", () => {
    it("should call network client post with correct URL and body", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue(validDto);

      // WHEN
      await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v2/ethereum/${validParams.chainId}/contract/proxy/delegate`,
        {
          proxy: validParams.proxyAddress,
          data: validParams.calldata,
          challenge: validParams.challenge,
        },
      );
    });

    it("should return Right with proxy implementation data when request succeeds with valid DTO", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue(validDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isRight()).toBe(true);
      expect(result.extract()).toEqual({
        implementationAddress: validDto.addresses[0],
        signedDescriptor: validDto.signedDescriptor,
        keyId: KeyId.DomainMetadataKey,
        keyUsage: KeyUsage.TrustedName,
      });
    });

    it("should return Right with first address when multiple addresses are provided", async () => {
      // GIVEN
      const dtoWithMultipleAddresses: ProxyDelegateCallDto = {
        addresses: [
          "0x9876543210987654321098765432109876543210",
          "0x1111111111111111111111111111111111111111",
        ],
        signedDescriptor: "signed-descriptor-data",
      };
      httpMock.post.mockResolvedValue(dtoWithMultipleAddresses);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isRight()).toBe(true);
      expect(result.extract()).toEqual({
        implementationAddress: dtoWithMultipleAddresses.addresses[0],
        signedDescriptor: dtoWithMultipleAddresses.signedDescriptor,
        keyId: KeyId.DomainMetadataKey,
        keyUsage: KeyUsage.TrustedName,
      });
    });

    it("should return Left with error when network client throws", async () => {
      // GIVEN
      httpMock.post.mockRejectedValue(new Error("Network error"));

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          "[ContextModule] HttpProxyDataSource: Failed to fetch delegate proxy",
        ),
      );
    });

    it("should return Left with error when response data is undefined", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue(undefined);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when response data is null", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue(null);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when addresses field is missing", async () => {
      // GIVEN
      const { addresses: _, ...invalidDto } = validDto;
      httpMock.post.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when signedDescriptor is missing", async () => {
      // GIVEN
      const { signedDescriptor: _, ...invalidDto } = validDto;
      httpMock.post.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when addresses is not an array", async () => {
      // GIVEN
      const invalidDto = { ...validDto, addresses: "not-an-array" };
      httpMock.post.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when addresses array contains non-string values", async () => {
      // GIVEN
      const invalidDto = { ...validDto, addresses: [123, "valid-address"] };
      httpMock.post.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when signedDescriptor is not a string", async () => {
      // GIVEN
      const invalidDto = { ...validDto, signedDescriptor: 123 };
      httpMock.post.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when addresses array is empty", async () => {
      // GIVEN
      const invalidDto: ProxyDelegateCallDto = {
        addresses: [],
        signedDescriptor: "signed-descriptor-data",
      };
      httpMock.post.mockResolvedValue(invalidDto);

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: No implementation address found for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when response is not an object", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue("not an object");

      // WHEN
      const result =
        await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toEqual(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should handle different chainId values correctly", async () => {
      // GIVEN
      const paramsWithDifferentChainId = { ...validParams, chainId: 137 };
      httpMock.post.mockResolvedValue(validDto);

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentChainId,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(httpMock.post).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v2/ethereum/137/contract/proxy/delegate`,
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
      httpMock.post.mockResolvedValue(validDto);

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentAddress,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(httpMock.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          proxy: differentProxyAddress,
        }),
      );
    });

    it("should handle different calldata values correctly", async () => {
      // GIVEN
      const customCalldata = "0x123456789abcdef";
      const paramsWithCustomCalldata = {
        ...validParams,
        calldata: customCalldata,
      };
      httpMock.post.mockResolvedValue(validDto);

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomCalldata,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(httpMock.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: customCalldata,
        }),
      );
    });

    it("should pass challenge parameter correctly", async () => {
      // GIVEN
      const customChallenge = "custom-challenge-string";
      const paramsWithCustomChallenge = {
        ...validParams,
        challenge: customChallenge,
      };
      httpMock.post.mockResolvedValue(validDto);

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomChallenge,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(httpMock.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          challenge: customChallenge,
        }),
      );
    });
  });
});

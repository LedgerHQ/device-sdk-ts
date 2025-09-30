import axios from "axios";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { type ProxyDelegateCallDto } from "./dto/ProxyDelegateCallDto";
import { HttpProxyDataSource } from "./HttpProxyDataSource";
import { type ProxyDataSource } from "./ProxyDataSource";

vi.mock("axios");

const config = {
  metadataServiceDomain: {
    url: "https://metadata.api.live.ledger.com",
  },
  originToken: "test-origin-token",
} as ContextModuleConfig;

describe("HttpProxyDataSource", () => {
  let datasource: ProxyDataSource;

  beforeAll(() => {
    datasource = new HttpProxyDataSource(config);
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
    it("should call axios with correct URL, headers, and data", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = vi.fn(() => Promise.resolve({ data: validDto }));
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(requestSpy).toHaveBeenCalledWith({
        method: "POST",
        url: `${config.metadataServiceDomain.url}/v2/ethereum/${validParams.chainId}/contract/proxy/delegate`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: version,
          [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
        },
        data: {
          proxy: validParams.proxyAddress,
          data: validParams.calldata,
          challenge: validParams.challenge,
        },
      });
    });

    it("should return Right with proxy implementation data when request succeeds with valid DTO", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValue({ data: validDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({
        data: dtoWithMultipleAddresses,
      });

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

    it("should return Left with error when axios throws an error", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValue(new Error("Network error"));

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: undefined });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: null });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: "not an object" });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: validDto });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentChainId,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${config.metadataServiceDomain.url}/v2/ethereum/137/contract/proxy/delegate`,
        }),
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
      vi.spyOn(axios, "request").mockResolvedValue({ data: validDto });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentAddress,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proxy: differentProxyAddress,
          }),
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
      vi.spyOn(axios, "request").mockResolvedValue({ data: validDto });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomCalldata,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: customCalldata,
          }),
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
      vi.spyOn(axios, "request").mockResolvedValue({ data: validDto });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomChallenge,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            challenge: customChallenge,
          }),
        }),
      );
    });
  });
});

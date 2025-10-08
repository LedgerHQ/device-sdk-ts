import axios from "axios";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { type SafeProxyImplementationAddressDto } from "./dto/SafeProxyImplementationAddressDto";
import { HttpSafeProxyDataSource } from "./HttpSafeProxyDataSource";
import { type ProxyDataSource } from "./ProxyDataSource";

vi.mock("axios");

const config = {
  metadataServiceDomain: {
    url: "https://metadata.api.live.ledger.com",
  },
  originToken: "test-origin-token",
} as ContextModuleConfig;

describe("HttpSafeProxyDataSource", () => {
  let datasource: ProxyDataSource;

  beforeAll(() => {
    datasource = new HttpSafeProxyDataSource(config);
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
    it("should call axios with correct URL, headers, and parameters", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = vi.fn(() => Promise.resolve({ data: validDto }));
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(requestSpy).toHaveBeenCalledWith({
        method: "GET",
        url: `${config.metadataServiceDomain.url}/v3/ethereum/${validParams.chainId}/contract/proxy/${validParams.proxyAddress}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: version,
          [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
        },
        params: {
          challenge: validParams.challenge,
          resolver: "SAFE_GATEWAY",
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
        implementationAddress: validDto.implementationAddress,
        signedDescriptor: validDto.signedDescriptor,
        keyId: "testKeyId",
        keyUsage: "testKeyUsage",
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
          "[ContextModule] HttpSafeProxyDataSource: Failed to fetch safe proxy implementation",
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
          `[ContextModule] HttpSafeProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
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
          `[ContextModule] HttpSafeProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when proxyAddress is missing", async () => {
      // GIVEN
      const { proxyAddress: _, ...invalidDto } = validDto;
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: invalidDto });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: "not an object" });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: null });

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
      vi.spyOn(axios, "request").mockResolvedValue({ data: validDto });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentChainId,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${config.metadataServiceDomain.url}/v3/ethereum/137/contract/proxy/${validParams.proxyAddress}`,
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
          url: `${config.metadataServiceDomain.url}/v3/ethereum/${validParams.chainId}/contract/proxy/${differentProxyAddress}`,
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
          params: {
            challenge: customChallenge,
            resolver: "SAFE_GATEWAY",
          },
        }),
      );
    });
  });
});

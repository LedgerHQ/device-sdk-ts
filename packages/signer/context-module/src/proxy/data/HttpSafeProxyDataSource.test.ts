import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { type SafeProxyImplementationAddressDto } from "./dto/SafeProxyImplementationAddressDto";
import { HttpSafeProxyDataSource } from "./HttpSafeProxyDataSource";
import { type ProxyDataSource } from "./ProxyDataSource";

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
    it("should call fetch with correct URL, headers, and parameters", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(fetchSpy).toHaveBeenCalled();
      const calledUrl = new URL(fetchSpy.mock.calls[0]![0]!.toString());
      expect(calledUrl.origin + calledUrl.pathname).toBe(
        `${config.metadataServiceDomain.url}/v3/ethereum/${validParams.chainId}/contract/proxy/${validParams.proxyAddress}`,
      );
      expect(calledUrl.searchParams.get("challenge")).toBe(
        validParams.challenge,
      );
      expect(calledUrl.searchParams.get("resolver")).toBe("SAFE_GATEWAY");
      expect(fetchSpy.mock.calls[0]![1]).toEqual({
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: version,
          [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
        },
      });
    });

    it("should return Right with proxy implementation data when request succeeds with valid DTO", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

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

    it("should return Left with error when fetch throws an error", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(undefined),
      } as Response);

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("null"),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(invalidDto)),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify("not an object")),
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("null"),
      );

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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentChainId,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      const calledUrl = fetchSpy.mock.calls[0]![0]!.toString();
      expect(calledUrl).toContain(
        `${config.metadataServiceDomain.url}/v3/ethereum/137/contract/proxy/${validParams.proxyAddress}`,
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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentAddress,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      const calledUrl = fetchSpy.mock.calls[0]![0]!.toString();
      expect(calledUrl).toContain(
        `${config.metadataServiceDomain.url}/v3/ethereum/${validParams.chainId}/contract/proxy/${differentProxyAddress}`,
      );
    });

    it("should pass challenge parameter correctly", async () => {
      // GIVEN
      const customChallenge = "custom-challenge-string";
      const paramsWithCustomChallenge = {
        ...validParams,
        challenge: customChallenge,
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomChallenge,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      const calledUrl = new URL(fetchSpy.mock.calls[0]![0]!.toString());
      expect(calledUrl.searchParams.get("challenge")).toBe(customChallenge);
      expect(calledUrl.searchParams.get("resolver")).toBe("SAFE_GATEWAY");
    });
  });
});

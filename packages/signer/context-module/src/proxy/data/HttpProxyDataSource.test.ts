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
    it("should call fetch with correct URL, headers, and body", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      await datasource.getProxyImplementationAddress(validParams);

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v2/ethereum/${validParams.chainId}/contract/proxy/delegate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [LEDGER_CLIENT_VERSION_HEADER]: version,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
          body: JSON.stringify({
            proxy: validParams.proxyAddress,
            data: validParams.calldata,
            challenge: validParams.challenge,
          }),
        },
      );
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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(dtoWithMultipleAddresses)),
      );

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
          "[ContextModule] HttpProxyDataSource: Failed to fetch delegate proxy",
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
          `[ContextModule] HttpProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
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
          `[ContextModule] HttpProxyDataSource: No data received for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when addresses field is missing", async () => {
      // GIVEN
      const { addresses: _, ...invalidDto } = validDto;
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
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
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
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when addresses is not an array", async () => {
      // GIVEN
      const invalidDto = { ...validDto, addresses: "not-an-array" };
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
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when addresses array contains non-string values", async () => {
      // GIVEN
      const invalidDto = { ...validDto, addresses: [123, "valid-address"] };
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
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
        ),
      );
    });

    it("should return Left with error when signedDescriptor is not a string", async () => {
      // GIVEN
      const invalidDto = { ...validDto, signedDescriptor: 123 };
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
          `[ContextModule] HttpProxyDataSource: No implementation address found for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
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
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${validParams.proxyAddress} on chain ${validParams.chainId}`,
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
      expect(fetchSpy).toHaveBeenCalledWith(
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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithDifferentAddress,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      const calledBody = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as { body: string }).body,
      );
      expect(calledBody).toEqual(
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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomCalldata,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      const calledBody = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as { body: string }).body,
      );
      expect(calledBody).toEqual(
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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validDto)),
      );

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        paramsWithCustomChallenge,
      );

      // THEN
      expect(result.isRight()).toBe(true);
      const calledBody = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as { body: string }).body,
      );
      expect(calledBody).toEqual(
        expect.objectContaining({
          challenge: customChallenge,
        }),
      );
    });
  });
});

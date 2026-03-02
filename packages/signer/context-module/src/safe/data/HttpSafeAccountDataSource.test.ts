import { type HexaString } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpSafeAccountDataSource } from "@/safe/data/HttpSafeAccountDataSource";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

describe("HttpSafeAccountDataSource", () => {
  const config: ContextModuleConfig = {
    metadataServiceDomain: {
      url: "https://metadata.ledger.com",
    },
    originToken: "test-origin-token",
  } as ContextModuleConfig;

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDescriptors", () => {
    it("should return safe account descriptors on successful request", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validSafeAccountDto)),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

      // THEN
      expect(fetchSpy).toHaveBeenCalled();
      const calledUrl = fetchSpy.mock.calls[0]![0]!.toString();
      expect(calledUrl).toBe(
        "https://metadata.ledger.com/v2/ethereum/1/safe/account/0x1234567890123456789012345678901234567890?challenge=0xabcdef",
      );
      expect(fetchSpy.mock.calls[0]![1]).toEqual({
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: "test-origin-token",
        },
      });
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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validSafeAccountDto)),
      );

      // WHEN
      await new HttpSafeAccountDataSource(config).getDescriptors(params);

      // THEN
      const calledUrl = fetchSpy.mock.calls[0]![0]!.toString();
      expect(calledUrl).toContain(
        "/v2/ethereum/137/safe/account/0x1234567890123456789012345678901234567890",
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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validSafeAccountDto)),
      );

      // WHEN
      await new HttpSafeAccountDataSource(config).getDescriptors(params);

      // THEN
      const calledUrl = fetchSpy.mock.calls[0]![0]!.toString();
      expect(calledUrl).toContain(
        "/v2/ethereum/1/safe/account/0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      );
    });

    it("should work with different challenges", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0x123456789",
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validSafeAccountDto)),
      );

      // WHEN
      await new HttpSafeAccountDataSource(config).getDescriptors(params);

      // THEN
      const calledUrl = new URL(fetchSpy.mock.calls[0]![0]!.toString());
      expect(calledUrl.searchParams.get("challenge")).toBe("0x123456789");
    });

    it("should return error when response data is empty", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("null"),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(undefined),
      } as Response);

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            signersDescriptor: validSafeAccountDto.signersDescriptor,
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            accountDescriptor: validSafeAccountDto.accountDescriptor,
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            accountDescriptor: {
              keyId: "account-key-id",
              keyUsage: "account-key-usage",
            },
            signersDescriptor: validSafeAccountDto.signersDescriptor,
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            accountDescriptor: {
              signedDescriptor: "account-signed-descriptor-data",
              keyUsage: "account-key-usage",
            },
            signersDescriptor: validSafeAccountDto.signersDescriptor,
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            accountDescriptor: {
              signedDescriptor: "account-signed-descriptor-data",
              keyId: "account-key-id",
            },
            signersDescriptor: validSafeAccountDto.signersDescriptor,
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            accountDescriptor: validSafeAccountDto.accountDescriptor,
            signersDescriptor: {
              signedDescriptor: "signers-signed-descriptor-data",
              keyId: 123, // wrong type
              keyUsage: "signers-key-usage",
            },
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            accountDescriptor: "invalid-string",
            signersDescriptor: validSafeAccountDto.signersDescriptor,
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            accountDescriptor: validSafeAccountDto.accountDescriptor,
            signersDescriptor: null,
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: invalid safe account response format",
          ),
        ),
      );
    });

    it("should return error when fetch request fails", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpSafeAccountDataSource: Failed to fetch safe account descriptors",
          ),
        ),
      );
    });

    it("should return error when fetch throws an exception", async () => {
      // GIVEN
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
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
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
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
          }),
        ),
      );

      // WHEN
      const result = await new HttpSafeAccountDataSource(config).getDescriptors(
        params,
      );

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

    it("should use correct origin token from config", async () => {
      // GIVEN
      const customConfig: ContextModuleConfig = {
        metadataServiceDomain: {
          url: "https://metadata.ledger.com",
        },
        originToken: "custom-origin-token",
      } as ContextModuleConfig;
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validSafeAccountDto)),
      );

      // WHEN
      await new HttpSafeAccountDataSource(customConfig).getDescriptors(params);

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            [LEDGER_ORIGIN_TOKEN_HEADER]: "custom-origin-token",
          }),
        }),
      );
    });

    it("should use correct metadata service URL from config", async () => {
      // GIVEN
      const customConfig: ContextModuleConfig = {
        metadataServiceDomain: {
          url: "https://custom-metadata.example.com",
        },
        originToken: "test-token",
      } as ContextModuleConfig;
      const params = {
        safeContractAddress: validsafeContractAddress,
        chainId: 1,
        challenge: "0xabcdef",
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(validSafeAccountDto)),
      );

      // WHEN
      await new HttpSafeAccountDataSource(customConfig).getDescriptors(params);

      // THEN
      const calledUrl = fetchSpy.mock.calls[0]![0]!.toString();
      expect(calledUrl).toContain(
        "https://custom-metadata.example.com/v2/ethereum/1/safe/account/0x1234567890123456789012345678901234567890",
      );
    });
  });
});

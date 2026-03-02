import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import { HttpTrustedNameDataSource } from "@/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import PACKAGE from "@root/package.json";

const config = {
  cal: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  metadataServiceDomain: {
    url: "https://nft.api.live.ledger.com",
  },
  originToken: "originToken",
} as ContextModuleConfig;
describe("HttpTrustedNameDataSource", () => {
  let datasource: TrustedNameDataSource;

  beforeAll(() => {
    datasource = new HttpTrustedNameDataSource(config);
    vi.clearAllMocks();
  });

  describe("getDomainNamePayload", () => {
    it("should call fetch with the correct url and ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([])),
      );

      // WHEN
      await datasource.getDomainNamePayload({
        chainId: 137,
        challenge: "9876",
        domain: "hello.eth",
      });

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        `https://nft.api.live.ledger.com/v2/names/ethereum/137/forward/hello.eth?types=eoa&sources=ens&challenge=9876`,
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: version,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
        }),
      );
    });

    it("should throw an error when fetch throws an error", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error());

      // WHEN
      const result = await datasource.getDomainNamePayload({
        chainId: 137,
        challenge: "",
        domain: "hello.eth",
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: Failed to fetch domain name",
          ),
        ),
      );
    });

    it("should return an error when no payload is returned", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ test: "" })),
      );

      // WHEN
      const result = await datasource.getDomainNamePayload({
        chainId: 137,
        challenge: "",
        domain: "hello.eth",
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: Invalid trusted name response format for domain hello.eth on chain 137",
          ),
        ),
      );
    });

    it("should return a payload", async () => {
      // GIVEN
      const responseData = {
        signedDescriptor: { data: "payload", signatures: {} },
        keyId: "testKeyId",
        keyUsage: "testKeyUsage",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(responseData)),
      );

      // WHEN
      const result = await datasource.getDomainNamePayload({
        chainId: 137,
        challenge: "challenge",
        domain: "hello.eth",
      });

      // THEN
      expect(result).toEqual(
        Right({
          data: "payload",
          keyId: "testKeyId",
          keyUsage: "testKeyUsage",
        }),
      );
    });
  });

  describe("getTrustedNamePayload", () => {
    it("should call fetch with the correct url and ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([])),
      );

      // WHEN
      await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "5678",
        sources: ["ens", "crypto_asset_list"],
        types: ["eoa"],
      });

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        `https://nft.api.live.ledger.com/v2/names/ethereum/137/reverse/0x1234?types=eoa&sources=ens,crypto_asset_list&challenge=5678`,
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: version,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
        }),
      );
    });

    it("should throw an error when fetch throws an error", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error());

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: Failed to fetch trusted name",
          ),
        ),
      );
    });

    it("should return an error when no payload is returned", async () => {
      // GIVEN
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ test: "" })),
      );

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: Invalid trusted name response format for address 0x1234 on chain 137",
          ),
        ),
      );
    });

    it("should return an error when no keys are returned", async () => {
      // GIVEN
      const responseData = {
        signedDescriptor: { data: "payload", signatures: { prod: "12345" } },
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(responseData)),
      );

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTrustedNameDataSource: Invalid trusted name response format for address 0x1234 on chain 137",
          ),
        ),
      );
    });

    it("should return a payload", async () => {
      // GIVEN
      const responseData = {
        signedDescriptor: { data: "payload", signatures: {} },
        keyId: "testKeyId",
        keyUsage: "testKeyUsage",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(responseData)),
      );

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(
        Right({
          data: "payload",
          keyId: "testKeyId",
          keyUsage: "testKeyUsage",
        }),
      );
    });

    it("should return a payload with a signature", async () => {
      // GIVEN
      const responseData = {
        signedDescriptor: { data: "payload", signatures: { prod: "12345" } },
        keyId: "testKeyId",
        keyUsage: "testKeyUsage",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(responseData)),
      );

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(
        Right({
          data: "payload153012345",
          keyId: "testKeyId",
          keyUsage: "testKeyUsage",
        }),
      );
    });
  });
});

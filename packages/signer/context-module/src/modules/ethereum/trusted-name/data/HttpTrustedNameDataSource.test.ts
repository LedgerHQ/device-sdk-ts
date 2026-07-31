import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { HttpTrustedNameDataSource } from "@/modules/ethereum/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/modules/ethereum/trusted-name/data/TrustedNameDataSource";

const config = {
  cal: {
    url: "https://global.api.prd.ledger.com/cal/v1",
    mode: "prod",
    branch: "main",
  },
  metadataServiceDomain: {
    url: "https://nft.api.live.ledger.com",
  },
  originToken: "originToken",
} as ContextModuleServiceConfig;

describe("HttpTrustedNameDataSource", () => {
  let datasource: TrustedNameDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpTrustedNameDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("getDomainNamePayload", () => {
    it("should call http.get with the correct url and params", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue([]);

      // WHEN
      await datasource.getDomainNamePayload({
        chainId: 137,
        challenge: "9876",
        domain: "hello.eth",
      });

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v2/names/ethereum/137/forward/hello.eth`,
        {
          params: { types: "eoa", sources: "ens", challenge: "9876" },
        },
      );
    });

    it("should throw an error when http.get throws an error", async () => {
      // GIVEN
      httpMock.get.mockRejectedValue(new Error());

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
      httpMock.get.mockResolvedValue({ test: "" });

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
      httpMock.get.mockResolvedValue(responseData);

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
    it("should call http.get with the correct url and params", async () => {
      // GIVEN
      httpMock.get.mockResolvedValue([]);

      // WHEN
      await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "5678",
        sources: ["ens", "crypto_asset_list"],
        types: ["eoa"],
      });

      // THEN
      expect(httpMock.get).toHaveBeenCalledWith(
        `${config.metadataServiceDomain.url}/v2/names/ethereum/137/reverse/0x1234`,
        {
          params: {
            types: "eoa",
            sources: "ens,crypto_asset_list",
            challenge: "5678",
          },
        },
      );
    });

    it("should throw an error when http.get throws an error", async () => {
      // GIVEN
      httpMock.get.mockRejectedValue(new Error());

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
      httpMock.get.mockResolvedValue({ test: "" });

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
      httpMock.get.mockResolvedValue(responseData);

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
      httpMock.get.mockResolvedValue(responseData);

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
      httpMock.get.mockResolvedValue(responseData);

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

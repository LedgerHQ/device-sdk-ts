import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import { HttpTrustedNameDataSource } from "@/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import PACKAGE from "@root/package.json";

vi.mock("axios");

describe("HttpTrustedNameDataSource", () => {
  let datasource: TrustedNameDataSource;

  beforeAll(() => {
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "prod",
        branch: "main",
      },
    } as ContextModuleConfig;
    datasource = new HttpTrustedNameDataSource(config);
    vi.clearAllMocks();
  });

  describe("getDomainNamePayload", () => {
    it("should call axios with the correct url and ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getDomainNamePayload({
        chainId: 137,
        challenge: "9876",
        domain: "hello.eth",
      });

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://nft.api.live.ledger.com/v2/names/ethereum/137/forward/hello.eth?types=eoa&sources=ens&challenge=9876`,
          headers: { [LEDGER_CLIENT_VERSION_HEADER]: version },
        }),
      );
    });

    it("should throw an error when axios throws an error", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValue(new Error());

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
      const response = { data: { test: "" } };
      vi.spyOn(axios, "request").mockResolvedValue(response);

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
            "[ContextModule] HttpTrustedNameDataSource: error getting domain payload",
          ),
        ),
      );
    });

    it("should return a payload", async () => {
      // GIVEN
      const response = { data: { signedDescriptor: { data: "payload" } } };
      vi.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getDomainNamePayload({
        chainId: 137,
        challenge: "challenge",
        domain: "hello.eth",
      });

      // THEN
      expect(result).toEqual(Right("payload"));
    });
  });

  describe("getTrustedNamePayload", () => {
    it("should call axios with the correct url and ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "5678",
        sources: ["ens", "crypto_asset_list"],
        types: ["eoa"],
      });

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://nft.api.live.ledger.com/v2/names/ethereum/137/reverse/0x1234?types=eoa&sources=ens,crypto_asset_list&challenge=5678`,
          headers: { [LEDGER_CLIENT_VERSION_HEADER]: version },
        }),
      );
    });

    it("should throw an error when axios throws an error", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValue(new Error());

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
      const response = { data: { test: "" } };
      vi.spyOn(axios, "request").mockResolvedValue(response);

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
            "[ContextModule] HttpTrustedNameDataSource: no trusted name metadata for address 0x1234",
          ),
        ),
      );
    });

    it("should return a payload", async () => {
      // GIVEN
      const response = {
        data: {
          signedDescriptor: { data: "payload" },
        },
      };
      vi.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(Right("payload"));
    });

    it("should return a payload with a signature", async () => {
      // GIVEN
      const response = {
        data: {
          signedDescriptor: { data: "payload", signatures: { prod: "12345" } },
        },
      };
      vi.spyOn(axios, "request").mockResolvedValue(response);

      // WHEN
      const result = await datasource.getTrustedNamePayload({
        chainId: 137,
        address: "0x1234",
        challenge: "",
        sources: ["ens"],
        types: ["eoa"],
      });

      // THEN
      expect(result).toEqual(Right("payload153012345"));
    });
  });
});

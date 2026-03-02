import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import { type TransactionCheckDto } from "@/transaction-check/data/dto/TransactionCheckDto";
import { HttpTransactionCheckDataSource } from "@/transaction-check/data/HttpTransactionCheckDataSource";
import { type GetTransactionCheckParams } from "@/transaction-check/data/TransactionCheckDataSource";
import PACKAGE from "@root/package.json";

describe("HttpTransactionCheckDataSource", () => {
  const config = {
    web3checks: {
      url: "web3checksUrl",
    },
    originToken: "originToken",
  } as ContextModuleConfig;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getTransactionCheck", () => {
    it("should return an object if the request is successful", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      const dto: TransactionCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(dto)),
      );

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      // THEN
      expect(result).toEqual(
        Right({
          publicKeyId: "test-key-id",
          descriptor: "test-descriptor",
        }),
      );
    });

    it("should return an error if the request fails", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("error"));

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Failed to fetch web3 checks information",
          ),
        ),
      );
    });

    it("should return an error if the response is invalid", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      const dto = {};
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(dto)),
      );

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Cannot exploit transaction check data received",
          ),
        ),
      );
    });

    it("should return an error if public_key_id is missing", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      const dto = {
        descriptor: "test-descriptor",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(dto)),
      );

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Cannot exploit transaction check data received",
          ),
        ),
      );
    });

    it("should return an error if descriptor is missing", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      const dto = {
        public_key_id: "test-key-id",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(dto)),
      );

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Cannot exploit transaction check data received",
          ),
        ),
      );
    });

    it("should call fetch with the correct headers", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({})),
      );

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(params);

      // THEN
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          }),
        }),
      );
    });

    it("should call fetch with the correct URL and method", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({})),
      );

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(params);

      // THEN
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${config.web3checks.url}/ethereum/scan/tx`,
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should call fetch with the correct request body", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({})),
      );

      // WHEN
      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(params);

      // THEN
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            tx: {
              from: "0x1234567890123456789012345678901234567890",
              raw: "0xabcdef",
            },
            chain: 1,
          }),
        }),
      );
    });
  });
});

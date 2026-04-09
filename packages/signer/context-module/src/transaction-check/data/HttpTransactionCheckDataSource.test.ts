import axios from "axios";
import bs58 from "bs58";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import { type TransactionCheckDto } from "@/transaction-check/data/dto/TransactionCheckDto";
import {
  HttpTransactionCheckDataSource,
  WEB3CHECKS_SOLANA_TX_SCAN_PATH,
} from "@/transaction-check/data/HttpTransactionCheckDataSource";
import { type GetTransactionCheckParams } from "@/transaction-check/data/TransactionCheckDataSource";
import PACKAGE from "@root/package.json";

vi.mock("axios");

describe("HttpTransactionCheckDataSource", () => {
  const config = {
    web3checks: {
      url: "web3checksUrl",
    },
    originToken: "originToken",
  } as ContextModuleServiceConfig;

  const validEthParams: GetTransactionCheckParams = {
    kind: "ethereum",
    from: "0x1234567890123456789012345678901234567890",
    rawTx: "0xabcdef",
    chainId: 1,
  };

  const validSolFrom = bs58.encode(new Uint8Array(32).fill(2));
  const validSolRawTx = bs58.encode(new Uint8Array([1, 2, 3, 4]));

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getTransactionCheck", () => {
    it("should return an object if the request is successful (ethereum)", async () => {
      const dto: TransactionCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });

      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(validEthParams);

      expect(result).toEqual(
        Right({
          publicKeyId: "test-key-id",
          descriptor: "test-descriptor",
        }),
      );
    });

    it("should return an error if the request fails (ethereum)", async () => {
      vi.spyOn(axios, "request").mockRejectedValue(new Error("error"));

      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(validEthParams);

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Failed to fetch web3 checks information",
          ),
        ),
      );
    });

    it("should return an error if ethereum from is invalid hex", async () => {
      const params: GetTransactionCheckParams = {
        kind: "ethereum",
        from: "not-hex",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      expect(result.isLeft()).toBe(true);
      expect(axios.request).not.toHaveBeenCalled();
    });

    it("should return an error if the response is invalid", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({ data: {} });

      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(validEthParams);

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Cannot exploit transaction check data received",
          ),
        ),
      );
    });

    it("should return an error if public_key_id is missing", async () => {
      const dto = {
        descriptor: "test-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });

      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(validEthParams);

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Cannot exploit transaction check data received",
          ),
        ),
      );
    });

    it("should return an error if descriptor is missing", async () => {
      const dto = {
        public_key_id: "test-key-id",
      };
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });

      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(validEthParams);

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTransactionCheckDataSource: Cannot exploit transaction check data received",
          ),
        ),
      );
    });

    it("should call axios with the correct headers (ethereum)", async () => {
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(validEthParams);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
        }),
      );
    });

    it("should call axios with the correct URL and method (ethereum)", async () => {
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(validEthParams);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: `${config.web3checks.url}/ethereum/scan/tx`,
        }),
      );
    });

    it("should call axios with the correct request data (ethereum)", async () => {
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(validEthParams);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tx: {
              from: "0x1234567890123456789012345678901234567890",
              raw: "0xabcdef",
            },
            chain: 1,
          },
        }),
      );
    });

    it("should include optional domain and block on ethereum when provided", async () => {
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      const params: GetTransactionCheckParams = {
        kind: "ethereum",
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
        domain: "https://app.example.com",
        block: 21680884,
      };
      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(params);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tx: {
              from: "0x1234567890123456789012345678901234567890",
              raw: "0xabcdef",
            },
            chain: 1,
            domain: "https://app.example.com",
            block: 21680884,
          },
        }),
      );
    });

    it("should return an object if the request is successful (solana)", async () => {
      const params: GetTransactionCheckParams = {
        kind: "solana",
        from: validSolFrom,
        rawTx: validSolRawTx,
        chain: 1,
        domain: "https://example-dapp.com",
        block: 284578192,
      };
      const dto: TransactionCheckDto = {
        public_key_id: "sol-key-id",
        descriptor: "sol-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });

      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      expect(result).toEqual(
        Right({
          publicKeyId: "sol-key-id",
          descriptor: "sol-descriptor",
        }),
      );
    });

    it("should call axios with solana path and body (tx.from, tx.raw, chain, domain, block)", async () => {
      const params: GetTransactionCheckParams = {
        kind: "solana",
        from: validSolFrom,
        rawTx: validSolRawTx,
        chain: 1,
        domain: "https://example-dapp.com",
        block: 284578192,
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(params);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: `${config.web3checks.url}${WEB3CHECKS_SOLANA_TX_SCAN_PATH}`,
          data: {
            tx: {
              from: validSolFrom,
              raw: validSolRawTx,
            },
            chain: 1,
            domain: "https://example-dapp.com",
            block: 284578192,
          },
        }),
      );
    });

    it("should omit optional root fields on solana when not provided", async () => {
      const params: GetTransactionCheckParams = {
        kind: "solana",
        from: validSolFrom,
        rawTx: validSolRawTx,
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: {} });

      const dataSource = new HttpTransactionCheckDataSource(config);
      await dataSource.getTransactionCheck(params);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tx: {
              from: validSolFrom,
              raw: validSolRawTx,
            },
          },
        }),
      );
    });

    it("should not call axios when solana from is invalid base58", async () => {
      const params: GetTransactionCheckParams = {
        kind: "solana",
        from: "!!!",
        rawTx: validSolRawTx,
      };
      const dataSource = new HttpTransactionCheckDataSource(config);
      const result = await dataSource.getTransactionCheck(params);

      expect(result.isLeft()).toBe(true);
      expect(axios.request).not.toHaveBeenCalled();
    });
  });
});

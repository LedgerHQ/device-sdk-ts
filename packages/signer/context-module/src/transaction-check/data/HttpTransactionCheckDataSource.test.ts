import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type TransactionCheckDto } from "@/transaction-check/data/dto/TransactionCheckDto";
import { HttpTransactionCheckDataSource } from "@/transaction-check/data/HttpTransactionCheckDataSource";
import { type GetTransactionCheckParams } from "@/transaction-check/data/TransactionCheckDataSource";

describe("HttpTransactionCheckDataSource", () => {
  const config = {
    web3checks: {
      url: "https://web3checks.test",
    },
    originToken: "originToken",
  } as ContextModuleServiceConfig;

  let httpMock: { post: ReturnType<typeof vi.fn> };
  let dataSource: HttpTransactionCheckDataSource;

  beforeEach(() => {
    vi.resetAllMocks();
    httpMock = { post: vi.fn() };
    dataSource = new HttpTransactionCheckDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
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
      httpMock.post.mockResolvedValueOnce(dto);

      // WHEN
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
      httpMock.post.mockRejectedValue(new Error("error"));

      // WHEN
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
      httpMock.post.mockResolvedValue({});

      // WHEN
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
      httpMock.post.mockResolvedValue({
        descriptor: "test-descriptor",
      });

      // WHEN
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
      httpMock.post.mockResolvedValue({
        public_key_id: "test-key-id",
      });

      // WHEN
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

    it("should call http.post with the correct URL and body", async () => {
      // GIVEN
      const params: GetTransactionCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        rawTx: "0xabcdef",
        chainId: 1,
      };
      httpMock.post.mockResolvedValueOnce({});

      // WHEN
      await dataSource.getTransactionCheck(params);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        `${config.web3checks.url}/ethereum/scan/tx`,
        {
          tx: {
            from: "0x1234567890123456789012345678901234567890",
            raw: "0xabcdef",
          },
          chain: 1,
        },
      );
    });
  });
});

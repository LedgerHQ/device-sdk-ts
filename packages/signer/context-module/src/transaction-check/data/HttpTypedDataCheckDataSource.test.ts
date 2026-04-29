import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type TypedDataCheckDto } from "@/transaction-check/data/dto/TypedDataCheckDto";
import { HttpTypedDataCheckDataSource } from "@/transaction-check/data/HttpTypedDataCheckDataSource";
import {
  type GetTypedDataCheckParams,
  type TypedData,
} from "@/transaction-check/data/TypedDataCheckDataSource";

describe("HttpTypedDataCheckDataSource", () => {
  const config = {
    web3checks: {
      url: "https://web3checks.test",
    },
    originToken: "originToken",
  } as ContextModuleServiceConfig;

  let httpMock: { post: ReturnType<typeof vi.fn> };
  let dataSource: HttpTypedDataCheckDataSource;

  beforeEach(() => {
    vi.resetAllMocks();
    httpMock = { post: vi.fn() };
    dataSource = new HttpTypedDataCheckDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  describe("getTypedDataCheck", () => {
    const validTypedData: TypedData = {
      domain: {
        name: "Test Domain",
        version: "1",
        chainId: 1,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      },
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
      },
      primaryType: "Person",
      message: {
        name: "Alice",
        wallet: "0x1234567890123456789012345678901234567890",
      },
    };

    const params: GetTypedDataCheckParams = {
      from: "0x1234567890123456789012345678901234567890",
      data: validTypedData,
    };

    it("should return an object if the request is successful", async () => {
      // GIVEN
      const dto: TypedDataCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      httpMock.post.mockResolvedValueOnce(dto);

      // WHEN
      const result = await dataSource.getTypedDataCheck(params);

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
      httpMock.post.mockRejectedValue(new Error("error"));

      // WHEN
      const result = await dataSource.getTypedDataCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTypedDataCheckDataSource: Failed to fetch typed data check information",
          ),
        ),
      );
    });

    it("should return an error if the response is invalid", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue({});

      // WHEN
      const result = await dataSource.getTypedDataCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTypedDataCheckDataSource: Cannot exploit typed data check data received",
          ),
        ),
      );
    });

    it("should return an error if public_key_id is missing", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue({
        descriptor: "test-descriptor",
      });

      // WHEN
      const result = await dataSource.getTypedDataCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTypedDataCheckDataSource: Cannot exploit typed data check data received",
          ),
        ),
      );
    });

    it("should return an error if descriptor is missing", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue({
        public_key_id: "test-key-id",
      });

      // WHEN
      const result = await dataSource.getTypedDataCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTypedDataCheckDataSource: Cannot exploit typed data check data received",
          ),
        ),
      );
    });

    it("should return an error if public_key_id is null", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue({
        public_key_id: null,
        descriptor: "test-descriptor",
      });

      // WHEN
      const result = await dataSource.getTypedDataCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTypedDataCheckDataSource: Cannot exploit typed data check data received",
          ),
        ),
      );
    });

    it("should return an error if descriptor is null", async () => {
      // GIVEN
      httpMock.post.mockResolvedValue({
        public_key_id: "test-key-id",
        descriptor: null,
      });

      // WHEN
      const result = await dataSource.getTypedDataCheck(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpTypedDataCheckDataSource: Cannot exploit typed data check data received",
          ),
        ),
      );
    });

    it("should call http.post with the correct URL and body", async () => {
      // GIVEN
      const dto: TypedDataCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      httpMock.post.mockResolvedValueOnce(dto);

      // WHEN
      await dataSource.getTypedDataCheck(params);

      // THEN
      expect(httpMock.post).toHaveBeenCalledWith(
        `${config.web3checks.url}/ethereum/scan/eip-712`,
        {
          msg: {
            from: params.from,
            data: params.data,
          },
        },
      );
    });

    it("should handle empty typed data", async () => {
      // GIVEN
      const emptyTypedData: TypedData = {
        domain: {},
        types: {},
        primaryType: "",
        message: {},
      };
      const paramsWithEmptyData: GetTypedDataCheckParams = {
        from: "0x1234567890123456789012345678901234567890",
        data: emptyTypedData,
      };
      const dto: TypedDataCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      httpMock.post.mockResolvedValueOnce(dto);

      // WHEN
      const result = await dataSource.getTypedDataCheck(paramsWithEmptyData);

      // THEN
      expect(result).toEqual(
        Right({
          publicKeyId: "test-key-id",
          descriptor: "test-descriptor",
        }),
      );
    });
  });
});

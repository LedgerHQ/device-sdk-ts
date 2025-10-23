import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import { type TypedDataCheckDto } from "@/transaction-check/data/dto/TypedDataCheckDto";
import { HttpTypedDataCheckDataSource } from "@/transaction-check/data/HttpTypedDataCheckDataSource";
import {
  type GetTypedDataCheckParams,
  type TypedData,
} from "@/transaction-check/data/TypedDataCheckDataSource";
import PACKAGE from "@root/package.json";

vi.mock("axios");

describe("HttpTypedDataCheckDataSource", () => {
  const config = {
    web3checks: {
      url: "web3checksUrl",
    },
    originToken: "originToken",
  } as ContextModuleConfig;

  beforeEach(() => {
    vi.resetAllMocks();
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
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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
      vi.spyOn(axios, "request").mockRejectedValue(new Error("error"));

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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
      const dto = {};
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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
      const dto = {
        descriptor: "test-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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
      const dto = {
        public_key_id: "test-key-id",
      };
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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
      const dto = {
        public_key_id: null,
        descriptor: "test-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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
      const dto = {
        public_key_id: "test-key-id",
        descriptor: null,
      };
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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

    it("should call axios with the correct headers", async () => {
      // GIVEN
      const dto: TypedDataCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
      await dataSource.getTypedDataCheck(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
        }),
      );
    });

    it("should call axios with the correct URL and method", async () => {
      // GIVEN
      const dto: TypedDataCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
      await dataSource.getTypedDataCheck(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: `${config.web3checks.url}/ethereum/scan/eip-712`,
        }),
      );
    });

    it("should call axios with the correct request data", async () => {
      // GIVEN
      const dto: TypedDataCheckDto = {
        public_key_id: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
      await dataSource.getTypedDataCheck(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            msg: {
              from: params.from,
              data: params.data,
            },
          },
        }),
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
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });

      // WHEN
      const dataSource = new HttpTypedDataCheckDataSource(config);
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

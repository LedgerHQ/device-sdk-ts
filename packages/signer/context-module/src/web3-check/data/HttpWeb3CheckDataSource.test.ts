import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpWeb3CheckDataSource } from "@/web3-check/data/HttpWeb3CheckDataSource";
import { type Web3CheckDto } from "@/web3-check/data/Web3CheckDto";
import { type Web3CheckContext } from "@/web3-check/domain/web3CheckTypes";

jest.mock("axios");

describe("HttpWeb3CheckDataSource", () => {
  const config = {
    web3checks: {
      url: "web3checksUrl",
    },
  } as ContextModuleConfig;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("getWeb3Checks", () => {
    it("should return an object if the request is successful", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      };
      const dto: Web3CheckDto = {
        block: 1,
        public_key_id: "publicKeyId",
        descriptor: "descriptor",
      };
      jest.spyOn(axios, "request").mockResolvedValue({ data: dto });

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(config);
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Right({
          publicKeyId: "publicKeyId",
          descriptor: "descriptor",
        }),
      );
    });

    it("should return an error if the request fails", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      };
      jest.spyOn(axios, "request").mockRejectedValue(new Error("error"));

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(config);
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpWeb3CheckDataSource: Failed to fetch web3 checks informations",
          ),
        ),
      );
    });

    it("should return an error if the response is invalid", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      };
      const dto = {};
      jest.spyOn(axios, "request").mockResolvedValue({ data: dto });

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(config);
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpWeb3CheckDataSource: Cannot exploit Web3 checks data received",
          ),
        ),
      );
    });
  });
});

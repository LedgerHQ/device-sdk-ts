import axios from "axios";
import { Left, Right } from "purify-ts";

import {
  BTC_APP,
  BTC_APP_METADATA,
  CUSTOM_LOCK_SCREEN_APP,
  CUSTOM_LOCK_SCREEN_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import {
  DEFAULT_MANAGER_API_BASE_URL,
  DEFAULT_MOCK_SERVER_BASE_URL,
} from "@internal/manager-api//model/Const";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";

import { AxiosManagerApiDataSource } from "./AxiosManagerApiDataSource";

jest.mock("axios");

describe("AxiosManagerApiDataSource", () => {
  describe("getAppsByHash", () => {
    describe("success cases", () => {
      it("with BTC app, should return the metadata", async () => {
        const api = new AxiosManagerApiDataSource({
          managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
          mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
        });

        jest.spyOn(axios, "post").mockResolvedValue({
          data: [BTC_APP_METADATA],
        });

        const hashes = [BTC_APP.appFullHash];

        const apps = await api.getAppsByHash(hashes);

        expect(apps).toEqual(Right([BTC_APP_METADATA]));
      });

      it("with no apps, should return an empty list", async () => {
        const api = new AxiosManagerApiDataSource({
          managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
          mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
        });

        jest.spyOn(axios, "post").mockResolvedValue({
          data: [],
        });

        const hashes: string[] = [];

        const apps = await api.getAppsByHash(hashes);

        expect(apps).toEqual(Right([]));
      });

      it("with BTC app and custom lock screen, should return the metadata", async () => {
        const api = new AxiosManagerApiDataSource({
          managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
          mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
        });

        jest.spyOn(axios, "post").mockResolvedValue({
          data: [BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA],
        });

        const hashes = [
          BTC_APP.appFullHash,
          CUSTOM_LOCK_SCREEN_APP.appFullHash,
        ];

        const apps = await api.getAppsByHash(hashes);

        expect(apps).toEqual(
          Right([BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA]),
        );
      });
    });

    describe("error cases", () => {
      it("should throw an error if the request fails", async () => {
        const api = new AxiosManagerApiDataSource({
          managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
          mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
        });
        const err = new Error("fetch error");
        jest.spyOn(axios, "post").mockRejectedValue(err);

        const hashes = [BTC_APP.appFullHash];

        try {
          await api.getAppsByHash(hashes);
        } catch (error) {
          expect(error).toEqual(Left(new HttpFetchApiError(err)));
        }
      });
    });
  });
});

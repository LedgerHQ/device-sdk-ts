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
} from "@internal/manager-api/model/Const";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";

import { AxiosManagerApiDataSource } from "./AxiosManagerApiDataSource";

jest.mock("axios");

const mockGetDeviceVersion = {
  id: 17,
  target_id: "857735172",
};

const mockGetFirmwareVersion = {
  id: 361,
  perso: "perso_11",
};

describe("AxiosManagerApiDataSource", () => {
  describe("getAppsByHash", () => {
    describe("success cases", () => {
      afterEach(() => {
        jest.clearAllMocks();
      });
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
      afterEach(() => {
        jest.clearAllMocks();
      });
      it("should throw an error if the request fails", () => {
        // given
        const api = new AxiosManagerApiDataSource({
          managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
          mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
        });
        const err = new Error("fetch error");
        jest.spyOn(axios, "post").mockRejectedValue(err);

        const hashes = [BTC_APP.appFullHash];

        // when
        const response = api.getAppsByHash(hashes);

        // then
        expect(response).resolves.toEqual(Left(new HttpFetchApiError(err)));
      });
    });
  });

  describe("getDeviceVersion", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });
    it("should return a complete device version", () => {
      // given
      const api = new AxiosManagerApiDataSource({
        managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
        mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
      });
      jest
        .spyOn(axios, "get")
        .mockResolvedValue({ data: mockGetDeviceVersion });

      // when
      const response = api.getDeviceVersion("targetId", 42);

      // then
      expect(response).resolves.toEqual(Right(mockGetDeviceVersion));
    });
    it("should return an error if the request fails", () => {
      // given
      const api = new AxiosManagerApiDataSource({
        managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
        mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
      });
      const error = new Error("fetch error");
      jest.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = api.getDeviceVersion("targetId", 42);

      // then
      expect(response).resolves.toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("getFirmwareVersion", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });
    it("should return a complete firmware version", () => {
      // given
      const api = new AxiosManagerApiDataSource({
        managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
        mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
      });
      jest
        .spyOn(axios, "get")
        .mockResolvedValue({ data: mockGetFirmwareVersion });

      // when
      const response = api.getFirmwareVersion("versionName", 42, 21);

      // then
      expect(response).resolves.toEqual(Right(mockGetFirmwareVersion));
    });
    it("should return an error if the request fails", () => {
      // given
      const api = new AxiosManagerApiDataSource({
        managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
        mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
      });
      const error = new Error("fetch error");
      jest.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = api.getFirmwareVersion("versionName", 42, 21);

      // then
      expect(response).resolves.toEqual(Left(new HttpFetchApiError(error)));
    });
  });
});

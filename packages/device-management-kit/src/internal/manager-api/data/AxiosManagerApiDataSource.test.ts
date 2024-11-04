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
import { deviceVersionMockBuilder } from "@internal/manager-api/data/__mocks__/GetDeviceVersion";
import { firmwareVersionMockBuilder } from "@internal/manager-api/data/__mocks__/GetFirmwareVersion";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";

import { AxiosManagerApiDataSource } from "./AxiosManagerApiDataSource";

jest.mock("axios");

describe("AxiosManagerApiDataSource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
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
    it("should return a complete device version", () => {
      // given
      const api = new AxiosManagerApiDataSource({
        managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
        mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
      });
      const mockedDeviceVersion = deviceVersionMockBuilder();
      jest
        .spyOn(axios, "get")
        .mockResolvedValueOnce({ data: mockedDeviceVersion });

      // when
      const response = api.getDeviceVersion("targetId", 42);

      // then
      expect(response).resolves.toEqual(Right(mockedDeviceVersion));
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
    it("should return a complete firmware version", () => {
      // given
      const api = new AxiosManagerApiDataSource({
        managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
        mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
      });
      const mockedFirmwareVersion = firmwareVersionMockBuilder();
      jest
        .spyOn(axios, "get")
        .mockResolvedValueOnce({ data: mockedFirmwareVersion });

      // when
      const response = api.getFirmwareVersion("versionName", 42, 21);

      // then
      expect(response).resolves.toEqual(Right(mockedFirmwareVersion));
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

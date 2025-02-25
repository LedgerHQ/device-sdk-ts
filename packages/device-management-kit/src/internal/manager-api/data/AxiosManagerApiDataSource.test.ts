import axios from "axios";
import { Left, Right } from "purify-ts";

import {
  BTC_APP,
  BTC_APP_METADATA,
  CUSTOM_LOCK_SCREEN_APP,
  CUSTOM_LOCK_SCREEN_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import { type DmkConfig } from "@api/DmkConfig";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";

import { AxiosManagerApiDataSource } from "./AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "./ManagerApiDataSource";

vi.mock("axios");

const mockGetDeviceVersion = {
  id: 17,
  target_id: "857735172",
};

const mockGetFirmwareVersion = {
  id: 361,
  perso: "perso_11",
};

describe("AxiosManagerApiDataSource", () => {
  describe("getAppList", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a list of applications", () => {
      // given
      const apps = [BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA];
      vi.spyOn(axios, "get").mockResolvedValue({ data: apps });

      // when
      const response = api.getAppList({
        targetId: "targetId",
        provider: 42,
        firmwareVersionName: "firmwareVersionName",
      });

      // then
      expect(response).resolves.toEqual(Right(apps));
    });
    it("should return an error if the request fails", () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = api.getAppList({
        targetId: "targetId",
        provider: 42,
        firmwareVersionName: "firmwareVersionName",
      });

      // then
      expect(response).resolves.toEqual(Left(new HttpFetchApiError(error)));
    });
  });
  describe("getAppsByHash", () => {
    describe("success cases", () => {
      let api: ManagerApiDataSource;
      beforeEach(() => {
        api = new AxiosManagerApiDataSource({} as DmkConfig);
      });
      afterEach(() => {
        vi.clearAllMocks();
      });
      it("with BTC app, should return the metadata", async () => {
        vi.spyOn(axios, "post").mockResolvedValue({
          data: [BTC_APP_METADATA],
        });

        const hashes = [BTC_APP.appFullHash];

        const apps = await api.getAppsByHash({ hashes });

        expect(apps).toEqual(Right([BTC_APP_METADATA]));
      });

      it("with no apps, should return an empty list", async () => {
        vi.spyOn(axios, "post").mockResolvedValue({
          data: [],
        });

        const hashes: string[] = [];

        const apps = await api.getAppsByHash({ hashes });

        expect(apps).toEqual(Right([]));
      });

      it("with BTC app and custom lock screen, should return the metadata", async () => {
        vi.spyOn(axios, "post").mockResolvedValue({
          data: [BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA],
        });

        const hashes = [
          BTC_APP.appFullHash,
          CUSTOM_LOCK_SCREEN_APP.appFullHash,
        ];

        const apps = await api.getAppsByHash({ hashes });

        expect(apps).toEqual(
          Right([BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA]),
        );
      });
    });

    describe("error cases", () => {
      afterEach(() => {
        vi.clearAllMocks();
      });
      it("should throw an error if the request fails", () => {
        // given
        const api = new AxiosManagerApiDataSource({} as DmkConfig);

        const err = new Error("fetch error");
        vi.spyOn(axios, "post").mockRejectedValue(err);

        const hashes = [BTC_APP.appFullHash];

        // when
        const response = api.getAppsByHash({ hashes });

        // then
        expect(response).resolves.toEqual(Left(new HttpFetchApiError(err)));
      });
    });
  });

  describe("getDeviceVersion", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a complete device version", () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({ data: mockGetDeviceVersion });

      // when
      const response = api.getDeviceVersion({
        targetId: "targetId",
        provider: 42,
      });

      // then
      expect(response).resolves.toEqual(Right(mockGetDeviceVersion));
    });
    it("should return an error if the request fails", () => {
      // given

      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = api.getDeviceVersion({
        targetId: "targetId",
        provider: 42,
      });

      // then
      expect(response).resolves.toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("getFirmwareVersion", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a complete firmware version", () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: mockGetFirmwareVersion,
      });

      // when
      const response = api.getFirmwareVersion({
        version: "versionName",
        deviceId: 42,
        provider: 21,
      });

      // then
      expect(response).resolves.toEqual(Right(mockGetFirmwareVersion));
    });
    it("should return an error if the request fails", () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = api.getFirmwareVersion({
        version: "versionName",
        deviceId: 42,
        provider: 21,
      });

      // then
      expect(response).resolves.toEqual(Left(new HttpFetchApiError(error)));
    });
  });
});

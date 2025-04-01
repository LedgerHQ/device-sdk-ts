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
    it("should return a list of applications", async () => {
      // given
      const apps = [BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA];
      vi.spyOn(axios, "get").mockResolvedValue({ data: apps });

      // when
      const response = await api.getAppList({
        targetId: "targetId",
        firmwareVersionName: "firmwareVersionName",
      });

      // then
      expect(response).toEqual(Right(apps));
    });
    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getAppList({
        targetId: "targetId",
        firmwareVersionName: "firmwareVersionName",
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
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
      it("should throw an error if the request fails", async () => {
        // given
        const api = new AxiosManagerApiDataSource({} as DmkConfig);

        const err = new Error("fetch error");
        vi.spyOn(axios, "post").mockRejectedValue(err);

        const hashes = [BTC_APP.appFullHash];

        // when
        const response = await api.getAppsByHash({ hashes });

        // then
        expect(response).toEqual(Left(new HttpFetchApiError(err)));
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
    it("should return a complete device version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({ data: mockGetDeviceVersion });

      // when
      const response = await api.getDeviceVersion({
        targetId: "targetId",
      });

      // then
      expect(response).toEqual(Right(mockGetDeviceVersion));
    });
    it("should return an error if the request fails", async () => {
      // given

      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getDeviceVersion({
        targetId: "targetId",
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
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
    it("should return a complete firmware version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: mockGetFirmwareVersion,
      });

      // when
      const response = await api.getFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response).toEqual(Right(mockGetFirmwareVersion));
    });
    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });
  describe("setProvider", () => {
    let api: AxiosManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({
        managerApiUrl: "http://fake-url.com",
        provider: 1,
      } as DmkConfig);
    });

    it("should not change the provider if the new value is the same", () => {
      // given
      const initialProvider = (api as unknown as { _provider: number })
        ._provider;

      // when
      api.setProvider(initialProvider);

      // then
      expect((api as unknown as { _provider: number })._provider).toBe(
        initialProvider,
      );
    });

    it("should not change the provider if the new value is less than 1", () => {
      // given
      const initialProvider = (api as unknown as { _provider: number })
        ._provider;

      // when
      api.setProvider(0); // invalid
      api.setProvider(-5); // invalid

      // then
      expect((api as unknown as { _provider: number })._provider).toBe(
        initialProvider,
      );
    });

    it("should update the provider if a valid and different value is provided", () => {
      // given
      const newProvider = 2;

      // when
      api.setProvider(newProvider);

      // then
      expect((api as unknown as { _provider: number })._provider).toBe(
        newProvider,
      );
    });
  });
});

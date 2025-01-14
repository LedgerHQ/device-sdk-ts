import axios from "axios";
import WebSocket from "isomorphic-ws";
import { Left, Right } from "purify-ts";

import {
  BTC_APP,
  BTC_APP_METADATA,
  CUSTOM_LOCK_SCREEN_APP,
  CUSTOM_LOCK_SCREEN_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import { type DmkConfig } from "@api/DmkConfig";
import {
  HttpFetchApiError,
  WebSocketConnectionError,
} from "@internal/manager-api/model/Errors";

import { AxiosManagerApiDataSource } from "./AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "./ManagerApiDataSource";

jest.mock("axios");
jest.mock("isomorphic-ws", () => {
  // The chained mockImplementationOnce is used to simulate the WebSocket connection success and failure respectively, the order is important
  return jest
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error("WebSocket connection failed");
    });
});

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
      let api: ManagerApiDataSource;
      beforeEach(() => {
        api = new AxiosManagerApiDataSource({} as DmkConfig);
      });
      afterEach(() => {
        jest.clearAllMocks();
      });
      it("with BTC app, should return the metadata", async () => {
        jest.spyOn(axios, "post").mockResolvedValue({
          data: [BTC_APP_METADATA],
        });

        const hashes = [BTC_APP.appFullHash];

        const apps = await api.getAppsByHash(hashes);

        expect(apps).toEqual(Right([BTC_APP_METADATA]));
      });

      it("with no apps, should return an empty list", async () => {
        jest.spyOn(axios, "post").mockResolvedValue({
          data: [],
        });

        const hashes: string[] = [];

        const apps = await api.getAppsByHash(hashes);

        expect(apps).toEqual(Right([]));
      });

      it("with BTC app and custom lock screen, should return the metadata", async () => {
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
        const api = new AxiosManagerApiDataSource({} as DmkConfig);

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
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it("should return a complete device version", () => {
      // given
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

      const error = new Error("fetch error");
      jest.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = api.getDeviceVersion("targetId", 42);

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
      jest.clearAllMocks();
    });
    it("should return a complete firmware version", () => {
      // given
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
      const error = new Error("fetch error");
      jest.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = api.getFirmwareVersion("versionName", 42, 21);

      // then
      expect(response).resolves.toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("Secure Channel via WebSocket", () => {
    describe("Connection establishment", () => {
      afterEach(() => {
        jest.clearAllMocks();
      });
      it("should return an error if the WebSocket connection fails", () => {
        // given
        const api = new AxiosManagerApiDataSource({
          webSocketUrl: "wss://test-websocket-url",
        } as DmkConfig);
        // when
        const res = api._connectWebSocket("wss://test-websocket-url/test");
        // then
        expect(WebSocket).toHaveBeenCalledWith("wss://test-websocket-url/test");
        expect(res.extract()).toBeInstanceOf(WebSocket);
      });
      it("should return an error if the WebSocket connection fails", () => {
        // given
        const api = new AxiosManagerApiDataSource({
          webSocketUrl: "wss://test-websocket-url",
        } as DmkConfig);
        // when
        const res = api._connectWebSocket("wss://test-websocket-url/test");
        // then
        expect(res.extract()).toBeInstanceOf(WebSocketConnectionError);
      });
    });
    describe("Connections with different pathname", () => {
      let api: ManagerApiDataSource;
      beforeEach(() => {
        api = new AxiosManagerApiDataSource({
          webSocketUrl: "wss://test-websocket-url",
        } as DmkConfig);
      });
      afterEach(() => {
        jest.clearAllMocks();
      });
      it("should call _connectWebSocket with parameters for genuineCheck", () => {
        // given
        jest
          .spyOn(api as AxiosManagerApiDataSource, "_connectWebSocket")
          .mockReturnValue(Right({} as WebSocket));
        // when
        api.genuineCheck({
          targetId: "targetId",
          perso: "perso",
        });
        // then
        expect(
          (api as AxiosManagerApiDataSource)._connectWebSocket,
        ).toHaveBeenCalledWith(
          "wss://test-websocket-url/genuine?targetId=targetId&perso=perso",
        );
      });
      it("should call _connectWebSocket with parameters for listInstalledApps", () => {
        // given
        jest
          .spyOn(api as AxiosManagerApiDataSource, "_connectWebSocket")
          .mockReturnValue(Right({} as WebSocket));
        // when
        api.listInstalledApps({
          targetId: "targetId",
          perso: "perso",
        });
        // then
        expect(
          (api as AxiosManagerApiDataSource)._connectWebSocket,
        ).toHaveBeenCalledWith(
          "wss://test-websocket-url/apps/list?targetId=targetId&perso=perso",
        );
      });
      it("should call _connectWebSocket with parameters for updateMcu", () => {
        // given
        jest
          .spyOn(api as AxiosManagerApiDataSource, "_connectWebSocket")
          .mockReturnValue(Right({} as WebSocket));

        // when
        api.updateMcu({
          targetId: "targetId",
          version: "version",
        });
        // then
        expect(
          (api as AxiosManagerApiDataSource)._connectWebSocket,
        ).toHaveBeenCalledWith(
          "wss://test-websocket-url/mcu?targetId=targetId&version=version",
        );
      });
      it("should call _connectWebSocket with parameters for updateFirmware", () => {
        // given
        jest
          .spyOn(api as AxiosManagerApiDataSource, "_connectWebSocket")
          .mockReturnValue(Right({} as WebSocket));

        // when
        api.updateFirmware({
          targetId: "targetId",
          perso: "perso",
          firmware: "firmware",
          firmwareKey: "firmwareKey",
        });
        // then
        expect(
          (api as AxiosManagerApiDataSource)._connectWebSocket,
        ).toHaveBeenCalledWith(
          "wss://test-websocket-url/install?targetId=targetId&perso=perso&firmware=firmware&firmwareKey=firmwareKey",
        );
      });
      it("should call _connectWebSocket with parameters for installApp", () => {
        // given
        jest
          .spyOn(api as AxiosManagerApiDataSource, "_connectWebSocket")
          .mockReturnValue(Right({} as WebSocket));

        // when
        api.installApp({
          targetId: "targetId",
          perso: "perso",
          firmware: "firmware",
          firmwareKey: "firmwareKey",
          deleteKey: "deleteKey",
          hash: "hash",
        });
        // then
        expect(
          (api as AxiosManagerApiDataSource)._connectWebSocket,
        ).toHaveBeenCalledWith(
          "wss://test-websocket-url/install?targetId=targetId&perso=perso&firmware=firmware&firmwareKey=firmwareKey&deleteKey=deleteKey&hash=hash",
        );
      });
      it("should call _connectWebSocket with parameters for uninstallApp", () => {
        // given
        jest
          .spyOn(api as AxiosManagerApiDataSource, "_connectWebSocket")
          .mockReturnValue(Right({} as WebSocket));
        // when
        api.uninstallApp({
          targetId: "targetId",
          perso: "perso",
          firmware: "firmware",
          firmwareKey: "firmwareKey",
          deleteKey: "deleteKey",
          hash: "hash",
        });
        // then
        expect(
          (api as AxiosManagerApiDataSource)._connectWebSocket,
        ).toHaveBeenCalledWith(
          "wss://test-websocket-url/install?targetId=targetId&perso=perso&firmware=firmware&firmwareKey=firmwareKey&deleteKey=deleteKey&hash=hash",
        );
      });
    });
  });
});

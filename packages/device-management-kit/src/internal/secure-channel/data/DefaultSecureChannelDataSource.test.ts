import WebSocket from "isomorphic-ws";
import { Right } from "purify-ts";

import { type DmkConfig } from "@api/DmkConfig";
import { WebSocketConnectionError } from "@internal/secure-channel/model/Errors";

import { DefaultSecureChannelDataSource } from "./DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "./SecureChannelDataSource";

vi.mock("isomorphic-ws", () => {
  // The chained mockImplementationOnce is used to simulate the WebSocket connection success and failure respectively, the order is important
  return {
    default: vi
      .fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("WebSocket connection failed");
      }),
  };
});

describe("Secure Channel Data Source", () => {
  describe("Connection establishment", () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should return an error if the WebSocket connection fails", () => {
      // given
      const api = new DefaultSecureChannelDataSource({
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
      const api = new DefaultSecureChannelDataSource({
        webSocketUrl: "wss://test-websocket-url",
      } as DmkConfig);

      // when
      const res = api._connectWebSocket("wss://test-websocket-url/test");

      // then
      expect(res.extract()).toBeInstanceOf(WebSocketConnectionError);
    });
  });
  describe("Connections with different pathname", () => {
    let api: SecureChannelDataSource;

    beforeEach(() => {
      api = new DefaultSecureChannelDataSource({
        webSocketUrl: "wss://test-websocket-url",
      } as DmkConfig);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should call _connectWebSocket with parameters for genuineCheck", () => {
      // given
      vi.spyOn(
        api as DefaultSecureChannelDataSource,
        "_connectWebSocket",
      ).mockReturnValue(Right({} as WebSocket));

      // when
      api.genuineCheck({
        targetId: "targetId",
        perso: "perso",
      });

      // then
      expect(
        (api as DefaultSecureChannelDataSource)._connectWebSocket,
      ).toHaveBeenCalledWith(
        "wss://test-websocket-url/genuine?targetId=targetId&perso=perso",
      );
    });

    it("should call _connectWebSocket with parameters for listInstalledApps", () => {
      // given
      vi.spyOn(
        api as DefaultSecureChannelDataSource,
        "_connectWebSocket",
      ).mockReturnValue(Right({} as WebSocket));

      // when
      api.listInstalledApps({
        targetId: "targetId",
        perso: "perso",
      });

      // then
      expect(
        (api as DefaultSecureChannelDataSource)._connectWebSocket,
      ).toHaveBeenCalledWith(
        "wss://test-websocket-url/apps/list?targetId=targetId&perso=perso",
      );
    });

    it("should call _connectWebSocket with parameters for updateMcu", () => {
      // given
      vi.spyOn(
        api as DefaultSecureChannelDataSource,
        "_connectWebSocket",
      ).mockReturnValue(Right({} as WebSocket));

      // when
      api.updateMcu({
        targetId: "targetId",
        version: "version",
      });

      // then
      expect(
        (api as DefaultSecureChannelDataSource)._connectWebSocket,
      ).toHaveBeenCalledWith(
        "wss://test-websocket-url/mcu?targetId=targetId&version=version",
      );
    });

    it("should call _connectWebSocket with parameters for updateFirmware", () => {
      // given
      vi.spyOn(
        api as DefaultSecureChannelDataSource,
        "_connectWebSocket",
      ).mockReturnValue(Right({} as WebSocket));

      // when
      api.updateFirmware({
        targetId: "targetId",
        perso: "perso",
        firmware: "firmware",
        firmwareKey: "firmwareKey",
      });

      // then
      expect(
        (api as DefaultSecureChannelDataSource)._connectWebSocket,
      ).toHaveBeenCalledWith(
        "wss://test-websocket-url/install?targetId=targetId&perso=perso&firmware=firmware&firmwareKey=firmwareKey",
      );
    });

    it("should call _connectWebSocket with parameters for installApp", () => {
      // given
      vi.spyOn(
        api as DefaultSecureChannelDataSource,
        "_connectWebSocket",
      ).mockReturnValue(Right({} as WebSocket));

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
        (api as DefaultSecureChannelDataSource)._connectWebSocket,
      ).toHaveBeenCalledWith(
        "wss://test-websocket-url/install?targetId=targetId&perso=perso&firmware=firmware&firmwareKey=firmwareKey&deleteKey=deleteKey&hash=hash",
      );
    });

    it("should call _connectWebSocket with parameters for uninstallApp", () => {
      // given
      vi.spyOn(
        api as DefaultSecureChannelDataSource,
        "_connectWebSocket",
      ).mockReturnValue(Right({} as WebSocket));

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
        (api as DefaultSecureChannelDataSource)._connectWebSocket,
      ).toHaveBeenCalledWith(
        "wss://test-websocket-url/install?targetId=targetId&perso=perso&firmware=firmware&firmwareKey=firmwareKey&deleteKey=deleteKey&hash=hash",
      );
    });
  });
});

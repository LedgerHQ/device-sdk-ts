import { Container } from "inversify";

import { type DmkConfig } from "@api/DmkConfig";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { StubUseCase } from "@root/src/di.stub";

import { managerApiModuleFactory } from "./managerApiModule";
import { managerApiTypes } from "./managerApiTypes";

describe("managerApiModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof managerApiModuleFactory>;
    beforeEach(() => {
      mod = managerApiModuleFactory({
        stub: false,
        config: {
          managerApiUrl: "http://fake.url",
          mockUrl: "http://fake-mock.url",
          webSocketUrl: "http://fake-websocket.url",
        } as DmkConfig,
      });
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return none stubbed use cases", () => {
      const managerApiDataSource = container.get(
        managerApiTypes.ManagerApiDataSource,
      );
      expect(managerApiDataSource).toBeInstanceOf(AxiosManagerApiDataSource);

      const managerApiService = container.get(
        managerApiTypes.ManagerApiService,
      );
      expect(managerApiService).toBeInstanceOf(DefaultManagerApiService);

      const config = container.get(managerApiTypes.DmkConfig);
      expect(config).toEqual({
        managerApiUrl: "http://fake.url",
        mockUrl: "http://fake-mock.url",
        webSocketUrl: "http://fake-websocket.url",
      });
    });
  });

  describe("Stubbed", () => {
    let container: Container;
    let mod: ReturnType<typeof managerApiModuleFactory>;
    beforeEach(() => {
      mod = managerApiModuleFactory({
        stub: true,
        config: {
          managerApiUrl: "http://fake.url",
          mockUrl: "http://fake-mock.url",
          webSocketUrl: "http://fake-websocket.url",
        } as DmkConfig,
      });
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return stubbed use cases", () => {
      const managerApiDataSource = container.get(
        managerApiTypes.ManagerApiDataSource,
      );
      expect(managerApiDataSource).toBeInstanceOf(StubUseCase);

      const managerApiService = container.get(
        managerApiTypes.ManagerApiService,
      );
      expect(managerApiService).toBeInstanceOf(StubUseCase);

      const config = container.get(managerApiTypes.DmkConfig);
      expect(config).toEqual({
        managerApiUrl: "http://fake.url",
        mockUrl: "http://fake-mock.url",
        webSocketUrl: "http://fake-websocket.url",
      });
    });
  });
});

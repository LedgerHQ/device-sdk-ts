import { Container } from "inversify";

import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { StubUseCase } from "@root/src/di.stub";

import { managerApiModuleFactory } from "./managerApiModule";
import { managerApiTypes } from "./managerApiTypes";
// import { types } from "./managerApiTypes";

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
        },
      });
      container = new Container();
      container.load(mod);
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

      const config = container.get(managerApiTypes.SdkConfig);
      expect(config).toEqual({
        managerApiUrl: "http://fake.url",
        mockUrl: "http://fake-mock.url",
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
        },
      });
      container = new Container();
      container.load(mod);
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

      const config = container.get(managerApiTypes.SdkConfig);
      expect(config).toEqual({
        managerApiUrl: "http://fake.url",
        mockUrl: "http://fake-mock.url",
      });
    });
  });
});

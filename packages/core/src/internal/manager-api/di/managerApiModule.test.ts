import { Container } from "inversify";

import { DefaultManagerApiDataSource } from "@internal/manager-api/data/DefaultManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";

import { managerApiModuleFactory } from "./managerApiModule";
import { managerApiTypes } from "./managerApiTypes";
// import { types } from "./managerApiTypes";

describe("managerApiModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof managerApiModuleFactory>;
    beforeEach(() => {
      mod = managerApiModuleFactory({
        config: { managerApiUrl: "http://fake.url" },
      });
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return none mocked use cases", () => {
      const managerApiDataSource = container.get(
        managerApiTypes.ManagerApiDataSource,
      );
      expect(managerApiDataSource).toBeInstanceOf(DefaultManagerApiDataSource);

      const managerApiService = container.get(
        managerApiTypes.ManagerApiService,
      );
      expect(managerApiService).toBeInstanceOf(DefaultManagerApiService);

      const config = container.get(managerApiTypes.SdkConfig);
      expect(config).toEqual({ managerApiUrl: "http://fake.url" });
    });
  });
});

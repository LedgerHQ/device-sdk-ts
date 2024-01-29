import { Container } from "inversify";
import { FileLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource";
import { StubLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource.stub";
import { RestRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource";
import { StubRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource.stub";
import configModuleFactory from "./configModule";
import { types } from "./configTypes";

describe("configModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof configModuleFactory>;
    beforeEach(() => {
      mod = configModuleFactory();
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return none mocked data sources", () => {
      const localDataSource = container.get(types.LocalConfigDataSource);
      const remoteDataSource = container.get(types.RemoteConfigDataSource);
      expect(localDataSource).toBeInstanceOf(FileLocalConfigDataSource);
      expect(remoteDataSource).toBeInstanceOf(RestRemoteConfigDataSource);
    });
  });

  describe("Mocked", () => {
    let container: Container;
    let mod: ReturnType<typeof configModuleFactory>;
    beforeEach(() => {
      mod = configModuleFactory({ mock: true });
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return mocked data sources", () => {
      const localDataSource = container.get(types.LocalConfigDataSource);
      const remoteDataSource = container.get(types.RemoteConfigDataSource);
      expect(localDataSource).toBeInstanceOf(StubLocalConfigDataSource);
      expect(remoteDataSource).toBeInstanceOf(StubRemoteConfigDataSource);
    });
  });
});

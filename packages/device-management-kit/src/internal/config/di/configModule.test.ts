import { Container } from "inversify";

import { FileLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource";
import { StubLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource.stub";
import { RestRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource";
import { StubRemoteConfigDataSource } from "@internal/config/data/RemoteConfigDataSource.stub";

import { configModuleFactory } from "./configModule";
import { configTypes } from "./configTypes";

describe("configModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof configModuleFactory>;
    beforeEach(() => {
      mod = configModuleFactory({ stub: false });
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return none mocked data sources", () => {
      const localDataSource = container.get(configTypes.LocalConfigDataSource);
      const remoteDataSource = container.get(
        configTypes.RemoteConfigDataSource,
      );
      expect(localDataSource).toBeInstanceOf(FileLocalConfigDataSource);
      expect(remoteDataSource).toBeInstanceOf(RestRemoteConfigDataSource);
    });
  });

  describe("Mocked", () => {
    let container: Container;
    let mod: ReturnType<typeof configModuleFactory>;
    beforeEach(() => {
      mod = configModuleFactory({ stub: true });
      container = new Container();
      container.loadSync(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return mocked data sources", () => {
      const localDataSource = container.get(configTypes.LocalConfigDataSource);
      const remoteDataSource = container.get(
        configTypes.RemoteConfigDataSource,
      );
      expect(localDataSource).toBeInstanceOf(StubLocalConfigDataSource);
      expect(remoteDataSource).toBeInstanceOf(StubRemoteConfigDataSource);
    });
  });
});

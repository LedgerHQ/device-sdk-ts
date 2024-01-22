import { Container } from "inversify";
import configModuleFactory from "./configModule";
import { types } from "./configTypes";
import {
  FileLocalConfigDataSource,
  MockLocalConfigDataSource,
} from "../data/LocalConfigDataSource";
import {
  MockRemoteConfigDataSource,
  RestRemoteConfigDataSource,
} from "../data/RemoteConfigDataSource";

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
    beforeAll(() => {
      mod = configModuleFactory(true);
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return mocked data sources", () => {
      const localDataSource = container.get(types.LocalConfigDataSource);
      const remoteDataSource = container.get(types.RemoteConfigDataSource);
      expect(localDataSource).toBeInstanceOf(MockLocalConfigDataSource);
      expect(remoteDataSource).toBeInstanceOf(MockRemoteConfigDataSource);
    });
  });
});

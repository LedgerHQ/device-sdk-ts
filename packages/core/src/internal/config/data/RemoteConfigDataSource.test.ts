import { RemoteConfigDataSource } from "./ConfigDataSource";
import {
  RestRemoteConfigDataSource,
  MockRemoteConfigDataSource,
} from "./RemoteConfigDataSource";

let datasource: RemoteConfigDataSource;
describe("RemoteRestConfigDataSource", () => {
  describe("RestRemoteConfigDataSource", () => {
    beforeAll(() => {
      datasource = new RestRemoteConfigDataSource();
    });

    it("should return the config", async () => {
      expect(await datasource.getConfig()).toStrictEqual({
        name: "DeviceSDK",
        version: "0.0.0-fake.1",
      });
    });
  });
  describe("MockRemoteConfigDataSource", () => {
    beforeAll(() => {
      datasource = new MockRemoteConfigDataSource();
    });

    it("should return the config", async () => {
      expect(await datasource.getConfig()).toStrictEqual({
        name: "DeviceSDK",
        version: "0.0.0-fake.2",
      });
    });
  });
});

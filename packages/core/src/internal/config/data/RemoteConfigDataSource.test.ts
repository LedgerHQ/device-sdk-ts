import { RemoteConfigDataSource } from "./ConfigDataSource";
import { RestRemoteConfigDataSource } from "./RemoteConfigDataSource";
import { StubRemoteConfigDataSource } from "./RemoteConfigDataSource.stub";

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
      datasource = new StubRemoteConfigDataSource();
    });

    it("should return the config", async () => {
      expect(await datasource.getConfig()).toStrictEqual({
        name: "DeviceSDK",
        version: "0.0.0-fake.2",
      });
    });
  });
});

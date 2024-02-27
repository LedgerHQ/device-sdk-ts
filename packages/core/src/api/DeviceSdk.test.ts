import { LocalConfigDataSource } from "@internal/config/data/ConfigDataSource";
import { StubLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource.stub";
import { types as ConfigTypes } from "@internal/config/di/configTypes";
import pkg from "@root/package.json";

import { ConsoleLogger } from "./logger-subscriber/service/ConsoleLogger";
import { DeviceSdk } from "./DeviceSdk";

jest.mock("./logger-subscriber/service/ConsoleLogger");

let sdk: DeviceSdk;
let logger: ConsoleLogger;
describe("DeviceSdk", () => {
  describe("clean", () => {
    beforeEach(() => {
      logger = new ConsoleLogger();
      sdk = new DeviceSdk({ stub: false, loggers: [logger] });
    });

    it("should create an instance", () => {
      expect(sdk).toBeDefined();
      expect(sdk).toBeInstanceOf(DeviceSdk);
    });

    it("should return a clean `version`", async () => {
      expect(await sdk.getVersion()).toBe(pkg.version);
    });

    it("startScan should ....", () => {
      expect(sdk.startScan()).toBeFalsy();
    });

    it("stopScan should ....", () => {
      expect(sdk.stopScan()).toBeFalsy();
    });
  });

  describe("stubbed", () => {
    beforeEach(() => {
      sdk = new DeviceSdk({ stub: true, loggers: [] });
    });

    it("should create a stubbed version", () => {
      expect(sdk).toBeDefined();
      expect(sdk).toBeInstanceOf(DeviceSdk);
      expect(
        sdk.container.get<LocalConfigDataSource>(
          ConfigTypes.LocalConfigDataSource,
        ),
      ).toBeInstanceOf(StubLocalConfigDataSource);
    });

    it("should return a stubbed `version`", async () => {
      expect(await sdk.getVersion()).toBe("0.0.0-stub.1");
    });
  });

  describe("without args", () => {
    beforeEach(() => {
      sdk = new DeviceSdk();
    });

    it("should create an instance", () => {
      expect(sdk).toBeDefined();
      expect(sdk).toBeInstanceOf(DeviceSdk);
    });

    it("should return a clean `version`", async () => {
      expect(await sdk.getVersion()).toBe(pkg.version);
    });
  });
});

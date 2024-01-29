import { Either, Left } from "purify-ts";
import { ConfigService } from "./ConfigService";
import { DefaultConfigService } from "./DefaultConfigService";
import { JSONParseError } from "@internal/config/di/configTypes";

const localDataSource = {
  getConfig: jest.fn(),
};

const remoteDataSource = {
  getConfig: jest.fn(),
  parseResponse: jest.fn(),
};

let service: ConfigService;
describe("DefaultConfigService", () => {
  beforeEach(() => {
    remoteDataSource.getConfig.mockClear();
    localDataSource.getConfig.mockClear();
    service = new DefaultConfigService(localDataSource, remoteDataSource);
  });

  describe("when the local config is available", () => {
    it("should return the `local` version", async () => {
      localDataSource.getConfig.mockReturnValue(
        Either.of({
          name: "DeviceSDK",
          version: "1.0.0-local",
        })
      );

      expect(await service.getSdkConfig()).toStrictEqual({
        name: "DeviceSDK",
        version: "1.0.0-local",
      });
    });
  });

  describe("when the local config is not available, use remote", () => {
    it("should return the `remote` version", async () => {
      localDataSource.getConfig.mockReturnValue(Left(new JSONParseError()));
      remoteDataSource.getConfig.mockResolvedValue(
        Either.of({
          name: "DeviceSDK",
          version: "1.0.0-remote",
        })
      );

      expect(await service.getSdkConfig()).toStrictEqual({
        name: "DeviceSDK",
        version: "1.0.0-remote",
      });
    });
  });

  describe("when the local remote config are not available", () => {
    it("should return the `default` version", async () => {
      localDataSource.getConfig.mockReturnValue(Left(new JSONParseError()));
      remoteDataSource.getConfig.mockResolvedValue(Left(new JSONParseError()));

      expect(await service.getSdkConfig()).toStrictEqual({
        name: "DeadSdk",
        version: "0.0.0-dead.1",
      });
    });
  });
});

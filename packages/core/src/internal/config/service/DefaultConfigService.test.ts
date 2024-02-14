import { Either, Left } from "purify-ts";

import { JSONParseError } from "@internal/config/di/configTypes";

import { ConfigService } from "./ConfigService";
import { DefaultConfigService } from "./DefaultConfigService";

const localDataSource = {
  getConfig: jest.fn(),
};

const remoteDataSource = {
  getConfig: jest.fn(),
  parseResponse: jest.fn(),
};

const loggerService = {
  subscribers: [],
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

let service: ConfigService;
describe("DefaultConfigService", () => {
  beforeEach(() => {
    remoteDataSource.getConfig.mockClear();
    localDataSource.getConfig.mockClear();
    loggerService.debug.mockClear();
    loggerService.error.mockClear();
    loggerService.info.mockClear();
    loggerService.warn.mockClear();
    loggerService.subscribers = [];

    service = new DefaultConfigService(
      localDataSource,
      remoteDataSource,
      loggerService,
    );
  });

  describe("when the local config is available", () => {
    it("should return the `local` version", async () => {
      localDataSource.getConfig.mockReturnValue(
        Either.of({
          name: "DeviceSDK",
          version: "1.0.0-local",
        }),
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
        }),
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

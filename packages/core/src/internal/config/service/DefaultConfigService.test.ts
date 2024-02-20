import { Either, Left } from "purify-ts";

import { JSONParseError } from "@internal/config/di/configTypes";

import { DefaultLoggerService } from "../../logger/service/DefaultLoggerService";
import { FileLocalConfigDataSource } from "../data/LocalConfigDataSource";
import { RestRemoteConfigDataSource } from "../data/RemoteConfigDataSource";
import { ConfigService } from "./ConfigService";
import { DefaultConfigService } from "./DefaultConfigService";

jest.mock("../data/LocalConfigDataSource");
jest.mock("../data/RemoteConfigDataSource");

let localDataSource: jest.Mocked<FileLocalConfigDataSource>;
let remoteDataSource: jest.Mocked<RestRemoteConfigDataSource>;
let loggerService: jest.Mocked<DefaultLoggerService>;

let service: ConfigService;
describe("DefaultConfigService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localDataSource =
      new FileLocalConfigDataSource() as jest.Mocked<FileLocalConfigDataSource>;
    remoteDataSource =
      new RestRemoteConfigDataSource() as jest.Mocked<RestRemoteConfigDataSource>;

    loggerService = new DefaultLoggerService(
      [],
    ) as jest.Mocked<DefaultLoggerService>;

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

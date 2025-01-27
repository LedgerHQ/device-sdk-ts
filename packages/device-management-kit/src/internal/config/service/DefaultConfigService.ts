import { inject, injectable } from "inversify";

import type { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import type {
  LocalConfigDataSource,
  RemoteConfigDataSource,
} from "@internal/config/data/ConfigDataSource";
import { configTypes } from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";
import {
  LocalConfigFailure,
  RemoteConfigFailure,
} from "@internal/config/model/Errors";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

import { ConfigService } from "./ConfigService";

@injectable()
export class DefaultConfigService implements ConfigService {
  private _local: LocalConfigDataSource;
  private _remote: RemoteConfigDataSource;
  private _logger: LoggerPublisherService;
  constructor(
    @inject(configTypes.LocalConfigDataSource) local: LocalConfigDataSource,
    @inject(configTypes.RemoteConfigDataSource) remote: RemoteConfigDataSource,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._local = local;
    this._remote = remote;
    this._logger = loggerServiceFactory("config");
  }

  async getDmkConfig(): Promise<Config> {
    // Returns an Either<ReadFileError | JsonParseError, Config>
    const localConfig = this._local
      .getConfig()
      .ifLeft((error: LocalConfigFailure) => {
        this._logger.error("Local config not available", {
          data: { error },
        });
      });

    if (localConfig.isRight()) {
      const val = localConfig.extract();
      this._logger.info("Local config available", { data: { config: val } });
      return val;
    }

    return this._remote.getConfig().then((config) => {
      return config
        .mapLeft((error: RemoteConfigFailure) => {
          // Here we handle the error and return a default value
          this._logger.error("Local config available", { data: { error } });
          return { name: "DeadDmk", version: "0.0.0-dead.1" };
        })
        .extract();
    });
  }
}

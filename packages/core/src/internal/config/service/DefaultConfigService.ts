import { inject, injectable } from "inversify";

import type {
  LocalConfigDataSource,
  RemoteConfigDataSource,
} from "@internal/config/data/ConfigDataSource";
import { types as configTypes } from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";
import { types as loggerTypes } from "@internal/logger/di/loggerTypes";
import type { LoggerService } from "@internal/logger/service/LoggerService";

import { ConfigService } from "./ConfigService";

@injectable()
export class DefaultConfigService implements ConfigService {
  private _local: LocalConfigDataSource;
  private _remote: RemoteConfigDataSource;
  private _logger: LoggerService;
  constructor(
    @inject(configTypes.LocalConfigDataSource) local: LocalConfigDataSource,
    @inject(configTypes.RemoteConfigDataSource) remote: RemoteConfigDataSource,
    @inject(loggerTypes.LoggerServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerService,
  ) {
    this._local = local;
    this._remote = remote;
    this._logger = loggerServiceFactory("config");
  }

  async getSdkConfig(): Promise<Config> {
    // Returns an Either<ReadFileError | JsonParseError, Config>
    const localConfig = this._local.getConfig().ifLeft((error) => {
      this._logger.error("Local config not available", { data: { error } });
    });

    if (localConfig.isRight()) {
      const val = localConfig.extract();
      this._logger.info("Local config available", { data: { config: val } });
      return val;
    }

    return this._remote.getConfig().then((config) => {
      return config
        .mapLeft((error) => {
          // Here we handle the error and return a default value
          this._logger.error("Local config available", { data: { error } });
          return { name: "DeadSdk", version: "0.0.0-dead.1" };
        })
        .extract();
    });
  }
}

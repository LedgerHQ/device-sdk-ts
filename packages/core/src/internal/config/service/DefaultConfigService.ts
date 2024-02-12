import { inject, injectable } from "inversify";

import type {
  LocalConfigDataSource,
  RemoteConfigDataSource,
} from "@internal/config/data/ConfigDataSource";
import { types as configTypes } from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";
import { types as loggerTypes } from "@internal/logger/di/loggerTypes";
import { LogBuilder } from "@internal/logger/service/LogBuilder";
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
    @inject(loggerTypes.LoggerService) logger: LoggerService,
  ) {
    this._local = local;
    this._remote = remote;
    this._logger = logger;
  }

  async getSdkConfig(): Promise<Config> {
    // Returns an Either<ReadFileError | JsonParseError, Config>
    const localConfig = this._local.getConfig().ifLeft((err) => {
      const log = LogBuilder.buildFromError(err);
      log.addMessage("Local config not available");
      this._logger.error(log);
    });

    if (localConfig.isRight()) {
      const val = localConfig.extract();
      const log = LogBuilder.build({ type: "config" }, { config: val });
      log.addMessage("Local config available");
      log.addMessage(val.version);
      log.addMessage(val.name);
      this._logger.info(log);
      return val;
    }

    return this._remote.getConfig().then((config) => {
      return config
        .mapLeft((err) => {
          // Here we handle the error and return a default value
          const log = LogBuilder.buildFromError(err);
          log.addMessage("Remote config not available");
          this._logger.error(log);
          return { name: "DeadSdk", version: "0.0.0-dead.1" };
        })
        .extract();
    });
  }
}

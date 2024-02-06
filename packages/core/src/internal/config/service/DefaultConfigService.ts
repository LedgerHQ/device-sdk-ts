import type {
  LocalConfigDataSource,
  RemoteConfigDataSource,
} from "@internal/config/data/ConfigDataSource";
import { types } from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";
import { inject, injectable } from "inversify";

import { ConfigService } from "./ConfigService";

@injectable()
export class DefaultConfigService implements ConfigService {
  private _local: LocalConfigDataSource;
  private _remote: RemoteConfigDataSource;
  constructor(
    @inject(types.LocalConfigDataSource) local: LocalConfigDataSource,
    @inject(types.RemoteConfigDataSource) remote: RemoteConfigDataSource
  ) {
    this._local = local;
    this._remote = remote;
  }

  async getSdkConfig(): Promise<Config> {
    // Returns an Either<ReadFileError | JsonParseError, Config>
    const localConfig = this._local.getConfig().ifLeft((err) => {
      console.error("Local config not available");
      console.error(err);
    });

    if (localConfig.isRight()) {
      return localConfig.extract();
    }

    return this._remote.getConfig().then((config) => {
      return config
        .mapLeft((err) => {
          // Here we handle the error and return a default value
          console.error("Remote config not available");
          console.error(err);
          return { name: "DeadSdk", version: "0.0.0-dead.1" };
        })
        .extract();
    });
  }
}

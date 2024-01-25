import { inject, injectable } from "inversify";
import { ConfigService } from "./ConfigService";
import { types } from "../di/configTypes";
import type {
  LocalConfigDataSource,
  RemoteConfigDataSource,
} from "../data/ConfigDataSource";
import { Config } from "../model/Config";

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
    const localConfig = this._local.getConfig();
    if (localConfig?.version) {
      return this._local.getConfig();
    }

    return this._remote.getConfig().then((config) => config);
  }
}

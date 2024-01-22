import { inject, injectable } from "inversify";
import "reflect-metadata";
import { ConfigService } from "./ConfigService";
import { types } from "../di/configTypes";
import type {
  LocalConfigDataSource,
  RemoteConfigDataSource,
} from "../data/ConfigDataSource";

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

  async getSdkVersion(): Promise<string> {
    const localConfig = this._local.getConfig();
    if (localConfig?.version) {
      return this._local.getConfig().version;
    }

    return this._remote.getConfig().then((config) => config.version);
  }
}

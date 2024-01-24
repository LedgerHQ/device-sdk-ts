import { Either } from "purify-ts";
import { LocalConfigFailure, RemoteConfigFailure } from "../di/configTypes";
import { Config } from "../model/Config";

// Describe the different data sources interfaces our application could have

export interface LocalConfigDataSource {
  getConfig(): Either<LocalConfigFailure, Config>;
}

export interface RemoteConfigDataSource {
  getConfig(): Promise<Either<RemoteConfigFailure, Config>>;
}

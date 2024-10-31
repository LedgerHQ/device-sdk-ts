import { type Either } from "purify-ts";

import { type Config } from "@internal/config/model/Config";
import {
  type LocalConfigFailure,
  type RemoteConfigFailure,
} from "@internal/config/model/Errors";

// Describe the different data sources interfaces our application could have

export interface LocalConfigDataSource {
  getConfig(): Either<LocalConfigFailure, Config>;
}

export interface RemoteConfigDataSource {
  getConfig(): Promise<Either<RemoteConfigFailure, Config>>;
}

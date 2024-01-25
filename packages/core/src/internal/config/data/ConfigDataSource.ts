import { Config } from "../model/Config";

// Describe the different data sources interfaces our application could have

export interface LocalConfigDataSource {
  getConfig(): Config;
}

export interface RemoteConfigDataSource {
  getConfig(): Promise<Config>;
}

import { Config } from "../model/Config";

export interface ConfigService {
  getSdkConfig(): Promise<Config>;
}

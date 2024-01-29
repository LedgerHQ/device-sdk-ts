import { Config } from "@internal/config/model/Config";

export interface ConfigService {
  getSdkConfig(): Promise<Config>;
}

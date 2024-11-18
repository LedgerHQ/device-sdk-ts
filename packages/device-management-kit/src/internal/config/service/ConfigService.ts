import { type Config } from "@internal/config/model/Config";

export interface ConfigService {
  getDmkConfig(): Promise<Config>;
}

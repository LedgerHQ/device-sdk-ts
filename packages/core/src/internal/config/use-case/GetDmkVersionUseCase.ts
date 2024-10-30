import { inject, injectable } from "inversify";

import { configTypes } from "@internal/config/di/configTypes";
import type { ConfigService } from "@internal/config/service/ConfigService";

/**
 * class GetDmkVersionUseCase
 * This is our actual use case that our DMK will use.
 * We will have many use cases in our DMK, and each should be contained in its own file.
 */
@injectable()
export class GetDmkVersionUseCase {
  private _configService: ConfigService;
  constructor(@inject(configTypes.ConfigService) configService: ConfigService) {
    this._configService = configService;
  }
  async getDmkVersion(): Promise<string> {
    return (await this._configService.getDmkConfig()).version;
  }
}

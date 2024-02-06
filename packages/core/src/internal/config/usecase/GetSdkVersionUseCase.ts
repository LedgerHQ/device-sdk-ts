import { types } from "@internal/config/di/configTypes";
import type { ConfigService } from "@internal/config/service/ConfigService";
import { inject, injectable } from "inversify";

/**
 * class GetSDKVersionUseCase
 * This is our actual use case that our SDK will use.
 * We will have many use cases in our SDK, and each should be contained in its own file.
 */
@injectable()
export class GetSdkVersionUseCase {
  private _configService: ConfigService;
  constructor(@inject(types.ConfigService) configService: ConfigService) {
    this._configService = configService;
  }
  async getSdkVersion(): Promise<string> {
    return (await this._configService.getSdkConfig()).version;
  }
}

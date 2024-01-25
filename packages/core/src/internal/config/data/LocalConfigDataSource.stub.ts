import { injectable } from "inversify";
import { Either } from "purify-ts";
import { Config } from "@internal/config/model/Config";
import { LocalConfigDataSource } from "./ConfigDataSource";

/**
 *
 * class StubLocalConfigDataSource
 *
 */

@injectable()
export class StubLocalConfigDataSource implements LocalConfigDataSource {
  getConfig(): Either<never, Config> {
    return Either.of({
      name: "DeviceSDK",
      version: "0.0.0-mock.1",
    });
  }
}

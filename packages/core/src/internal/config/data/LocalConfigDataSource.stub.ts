import { injectable } from "inversify";
import { Config } from "../model/Config";
import { LocalConfigDataSource } from "./ConfigDataSource";
import { Either } from "purify-ts";

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

import { Config } from "@internal/config/model/Config";
import { injectable } from "inversify";
import { Either } from "purify-ts";

import { RemoteConfigDataSource } from "./ConfigDataSource";

/**
 * class RemoteRestConfigDataSource
 * This is a remote data source that reads the config from a remote API (example).
 */
@injectable()
export class StubRemoteConfigDataSource implements RemoteConfigDataSource {
  async getConfig(): Promise<Either<never, Config>> {
    return new Promise((res) =>
      res(
        Either.of({
          name: "DeviceSDK",
          version: "0.0.0-fake.2",
        })
      )
    );
  }
}

import { injectable } from "inversify";
import { RemoteConfigDataSource } from "./ConfigDataSource";
import { Config } from "../model/Config";
import { Either } from "purify-ts";

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

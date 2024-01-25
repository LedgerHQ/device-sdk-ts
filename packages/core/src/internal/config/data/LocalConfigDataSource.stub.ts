import { injectable } from "inversify";
import { Config } from "../model/Config";
import { LocalConfigDataSource } from "./ConfigDataSource";

/**
 *
 * class StubLocalConfigDataSource
 *
 */

@injectable()
export class StubLocalConfigDataSource implements LocalConfigDataSource {
  getConfig(): Config {
    return {
      name: "DeviceSDK",
      version: "0.0.0-mock.1",
    };
  }
}

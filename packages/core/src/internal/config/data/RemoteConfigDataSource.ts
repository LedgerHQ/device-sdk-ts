import { injectable } from "inversify";
import "reflect-metadata";
import { RemoteConfigDataSource } from "./ConfigDataSource";
import { ConfigDTO } from "./DTO";
import { Config } from "../model/Config";

/**
 * class RemoteRestConfigDataSource
 * This is a remote data source that reads the config from a remote API (example).
 */
@injectable()
export class RestRemoteConfigDataSource implements RemoteConfigDataSource {
  async getConfig() {
    // Fake API call
    const v = await new Promise<{ json: () => Promise<ConfigDTO> }>(
      (resolve) => {
        resolve({
          json: async () =>
            new Promise((res) =>
              res({
                name: "DeviceSDK",
                version: "0.0.0-fake.1",
                yolo: "yolo",
              })
            ),
        });
      }
    );
    const json = await v.json();
    const config = this._parseResponse(json);
    return config;
  }

  // Parser for the DTO
  // parserResponse: ConfigDTO => Config
  private _parseResponse(dto: ConfigDTO): Config {
    const { name, version } = dto;
    return { name, version };
  }
}

/**
 * class RemoteRestConfigDataSource
 * This is a remote data source that reads the config from a remote API (example).
 */
@injectable()
export class MockRemoteConfigDataSource implements RemoteConfigDataSource {
  async getConfig(): Promise<Config> {
    return new Promise((res) =>
      res({
        name: "DeviceSDK",
        version: "0.0.0-fake.2",
      })
    );
  }
}

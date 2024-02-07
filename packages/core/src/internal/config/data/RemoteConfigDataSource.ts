import { injectable } from "inversify";
import { Either, Left } from "purify-ts";

import {
  ApiCallError,
  JSONParseError,
  ParseResponseError,
  RemoteConfigFailure,
} from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";

import { RemoteConfigDataSource } from "./ConfigDataSource";
import { ConfigDto } from "./Dto";

/**
 * class RemoteRestConfigDataSource
 * This is a remote data source that reads the config from a remote API (example).
 */
@injectable()
export class RestRemoteConfigDataSource implements RemoteConfigDataSource {
  async getConfig(): Promise<Either<RemoteConfigFailure, Config>> {
    const call = await this._callApi();
    if (call.isLeft()) {
      console.error("ApiCallError");
      return Left(new ApiCallError(call.extract()));
    }

    if (!call.extract().ok) {
      console.error("ApiCallError");
      return Left(new ApiCallError(new Error("response not ok")));
    }

    const json = await call.extract().json();
    if (json.isLeft()) {
      console.error("JSONParseError");
      return Left(new JSONParseError());
    }

    return json
      .chain((dto) => this._parseResponse(dto))
      .map((config) => config);
  }

  // Parser for the Dto
  // parserResponse: ConfigDto => Config
  private _parseResponse(dto: ConfigDto): Either<ParseResponseError, Config> {
    const { name, version } = dto;
    if (!name || !version) {
      console.log("missing stuff");
      return Left(new ParseResponseError());
    }
    return Either.of({ name, version });
  }

  private _callApi(): Promise<
    Either<
      never,
      {
        ok: boolean;
        json: () => Promise<Either<JSONParseError, ConfigDto>>;
      }
    >
  > {
    return new Promise((res) => {
      res(
        Either.of({
          ok: true,
          json: async () =>
            new Promise((r) => {
              r(
                Either.of({
                  name: "DeviceSDK",
                  version: "0.0.0-fake.1",
                  yolo: "yolo",
                })
              );
            }),
        })
      );
    });
  }
}

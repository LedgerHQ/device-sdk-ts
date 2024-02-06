import {
  JSONParseError,
  LocalConfigFailure,
  ReadFileError,
} from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";
import { injectable } from "inversify";
import { Either } from "purify-ts";

import { LocalConfigDataSource } from "./ConfigDataSource";

const version = {
  name: "DeviceSDK",
  version: "0.0.0-local.1",
};

export const stubFsReadFile = () => JSON.stringify(version);

/**
 *
 * class FileLocalConfigDataSource
 * This is a local data source that reads the config from a local file.
 *
 */
@injectable()
export class FileLocalConfigDataSource implements LocalConfigDataSource {
  getConfig(): Either<LocalConfigFailure, Config> {
    return Either.encase(() => stubFsReadFile())
      .mapLeft((error) => {
        console.log("readFileSync error");
        return new ReadFileError(error);
      })
      .chain((str) => {
        return Either.encase(() => JSON.parse(str) as Config).mapLeft(
          (error) => {
            console.log("JSON.parse error");
            return new JSONParseError(error);
          }
        );
      });
  }
}

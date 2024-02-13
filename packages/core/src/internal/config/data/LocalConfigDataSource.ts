import { injectable } from "inversify";
import { Either } from "purify-ts";

import {
  JSONParseError,
  LocalConfigFailure,
  ReadFileError,
} from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";
import pkg from "@root/package.json";

import { LocalConfigDataSource } from "./ConfigDataSource";

const version = {
  name: pkg.name,
  version: pkg.version,
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
      .mapLeft((error) => new ReadFileError(error))
      .chain((str) => {
        return Either.encase(() => JSON.parse(str) as Config).mapLeft(
          (error) => new JSONParseError(error),
        );
      });
  }
}

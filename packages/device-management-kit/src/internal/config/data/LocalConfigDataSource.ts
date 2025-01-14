import { injectable } from "inversify";
import { Either } from "purify-ts";

import { Config, isConfig } from "@internal/config/model/Config";
import {
  JSONParseError,
  LocalConfigFailure,
  ReadFileError,
} from "@internal/config/model/Errors";
import pkg from "@root/package.json";

import { LocalConfigDataSource } from "./ConfigDataSource";

const version = {
  name: pkg.name,
  version: pkg.version,
};

export const stubFsReadFile = () => {
  try {
    return JSON.stringify(version);
  } catch (error) {
    throw error;
  }
};

@injectable()
/**
 * The data source for retrieving local configuration.
 */
export class FileLocalConfigDataSource implements LocalConfigDataSource {
  /**
   * Retrieves the local configuration.
   * @returns An `Either` containing either a `LocalConfigFailure` or a `Config` object.
   */
  getConfig(): Either<LocalConfigFailure, Config> {
    return Either.encase(() => stubFsReadFile())
      .mapLeft((error) => new ReadFileError(error))
      .chain((str) => {
        return Either.encase(() => {
          let config: unknown;
          try {
            config = JSON.parse(str);
          } catch (error) {
            console.log(error);
            throw error;
          }
          if (isConfig(config)) {
            return config;
          }
          throw new Error("Invalid config file");
        }).mapLeft((error) => new JSONParseError(error));
      });
  }
}

import fs from "fs";
import { injectable } from "inversify";
import path from "path";
import { Either } from "purify-ts";
import {
  ReadFileError,
  JSONParseError,
  LocalConfigFailure,
} from "@internal/config/di/configTypes";
import { Config } from "@internal/config/model/Config";
import { LocalConfigDataSource } from "./ConfigDataSource";

/**
 *
 * class FileLocalConfigDataSource
 * This is a local data source that reads the config from a local file.
 *
 */
@injectable()
export class FileLocalConfigDataSource implements LocalConfigDataSource {
  getConfig(): Either<LocalConfigFailure, Config> {
    return Either.encase(() =>
      fs.readFileSync(path.join(__dirname, "version.json"), "utf-8")
    )
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

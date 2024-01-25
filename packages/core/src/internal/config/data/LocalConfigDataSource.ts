import fs from "fs";
import { injectable } from "inversify";
import { Config } from "../model/Config";
import { LocalConfigDataSource } from "./ConfigDataSource";
import path from "path";

/**
 *
 * class FileLocalConfigDataSource
 * This is a local data source that reads the config from a local file.
 *
 */
@injectable()
export class FileLocalConfigDataSource implements LocalConfigDataSource {
  getConfig(): Config {
    const version = fs.readFileSync(
      path.join(__dirname, "version.json"),
      "utf-8"
    );
    return JSON.parse(version) as Config;
  }
}

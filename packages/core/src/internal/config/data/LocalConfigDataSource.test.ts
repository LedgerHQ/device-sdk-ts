import { Either, Left } from "purify-ts";
import { JSONParseError, ReadFileError } from "@internal/config/di/configTypes";
import { LocalConfigDataSource } from "./ConfigDataSource";
import * as LocalConfig from "./LocalConfigDataSource";

const { FileLocalConfigDataSource } = LocalConfig;

const readFileSyncSpy = jest.spyOn(LocalConfig, "stubFsReadFile");
const jsonParse = jest.spyOn(JSON, "parse");

let datasource: LocalConfigDataSource;
describe("LocalConfigDataSource", () => {
  describe("FileLocalConfigDataSource", () => {
    beforeEach(() => {
      readFileSyncSpy.mockClear();
      jsonParse.mockClear();
      datasource = new FileLocalConfigDataSource();
    });

    afterAll(() => {
      readFileSyncSpy.mockRestore();
      jsonParse.mockRestore();
    });

    it("should return an Either<never, Config>", () => {
      readFileSyncSpy.mockReturnValue(
        JSON.stringify({ name: "DeviceSDK", version: "0.0.0-spied.1" })
      );

      jsonParse.mockReturnValue({
        name: "DeviceSDK",
        version: "0.0.0-spied.1",
      });

      expect(datasource.getConfig()).toStrictEqual(
        Either.of({
          name: "DeviceSDK",
          version: "0.0.0-spied.1",
        })
      );
    });

    it("should return an Either<ReadFileError, never> if readFileSync throws", () => {
      const err = new Error("readFileSync error");
      readFileSyncSpy.mockImplementation(() => {
        throw err;
      });

      expect(datasource.getConfig()).toEqual(Left(new ReadFileError(err)));
    });

    it("should return an Either<JSONParseError, never> if JSON.parse throws", () => {
      const err = new Error("JSON.parse error");
      readFileSyncSpy.mockReturnValue(
        JSON.stringify({ name: "DeviceSDK", version: "0.0.0-spied.1" })
      );

      jsonParse.mockImplementation(() => {
        throw err;
      });

      expect(datasource.getConfig()).toEqual(Left(new JSONParseError(err)));
    });
  });

  describe("stubFsReadFile", () => {
    it("should return a stringified version of the version object", () => {
      expect(LocalConfig.stubFsReadFile()).toEqual(
        JSON.stringify({ name: "DeviceSDK", version: "0.0.0-local.1" })
      );
    });
  });
});

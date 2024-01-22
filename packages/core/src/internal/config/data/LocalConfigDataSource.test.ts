import fs from "fs";
import { LocalConfigDataSource } from "./ConfigDataSource";
import {
  FileLocalConfigDataSource,
  MockLocalConfigDataSource,
} from "./LocalConfigDataSource";

const readFileSyncSpy = jest.spyOn(fs, "readFileSync");

let datasource: LocalConfigDataSource;
describe("LocalConfigDataSource", () => {
  describe("FileLocalConfigDataSource", () => {
    beforeEach(() => {
      readFileSyncSpy.mockClear();
      datasource = new FileLocalConfigDataSource();
      readFileSyncSpy.mockReturnValue(
        JSON.stringify({ name: "DeviceSDK", version: "0.0.0-spied.1" })
      );
    });

    it("should return the config", () => {
      expect(datasource.getConfig()).toEqual({
        name: "DeviceSDK",
        version: "0.0.0-spied.1",
      });
    });
  });

  describe("MockLocalConfigDataSource", () => {
    beforeEach(() => {
      datasource = new MockLocalConfigDataSource();
    });

    it("should return the config", () => {
      expect(datasource.getConfig()).toEqual({
        name: "DeviceSDK",
        version: "0.0.0-mock.1",
      });
    });
  });

  afterAll(() => {
    readFileSyncSpy.mockClear();
  });
});

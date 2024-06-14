import { LocalConfigDataSource } from "@internal/config/data/ConfigDataSource";

export class FileLocalConfigDataSource implements LocalConfigDataSource {
  getConfig = jest.fn();
}

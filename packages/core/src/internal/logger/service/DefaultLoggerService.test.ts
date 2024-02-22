import { LogLevel } from "@api/index";
import { ConsoleLogger } from "@api/logger-subscriber/service/ConsoleLogger";

import { DefaultLoggerService } from "./DefaultLoggerService";

jest.mock("../../../api/logger-subscriber/service/ConsoleLogger");

let service: DefaultLoggerService;
let subscriber: jest.Mocked<ConsoleLogger>;
const message = "message";
const tag = "logger-tag";
const options = { data: { key: "value" } };
const generatedOptions = { tag, ...options };

describe("LoggerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriber = new ConsoleLogger() as jest.Mocked<ConsoleLogger>;
    service = new DefaultLoggerService([subscriber], tag);
  });

  it("should call subscriber.log with the correct log object", () => {
    service.info(message, options);
    expect(subscriber.log).toHaveBeenCalledWith(
      LogLevel.Info,
      message,
      generatedOptions,
    );
  });

  it("should call subscriber.log with the correct log object when a tag is provided", () => {
    const newTag = "new-tag";
    service.info(message, { ...options, tag: newTag });
    expect(subscriber.log).toHaveBeenCalledWith(LogLevel.Info, message, {
      ...generatedOptions,
      tag: newTag,
    });
  });

  it("should call _log with the correct LogLevel", () => {
    const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

    service.info(message, options);
    expect(spy).toHaveBeenCalledWith(LogLevel.Info, message, options);
  });

  it("should have the correct LogLevel", () => {
    const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

    service.debug(message, options);
    expect(spy).toHaveBeenCalledWith(LogLevel.Debug, message, options);
  });

  it("should have the correct LogLevel", () => {
    const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

    service.warn(message, options);
    expect(spy).toHaveBeenCalledWith(LogLevel.Warning, message, options);
  });

  it("should have the correct LogLevel", () => {
    const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

    service.error(message, options);
    expect(spy).toHaveBeenCalledWith(LogLevel.Error, message, options);
  });
});

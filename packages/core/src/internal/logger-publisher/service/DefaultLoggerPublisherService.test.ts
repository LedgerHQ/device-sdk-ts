import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { ConsoleLogger } from "@api/logger-subscriber/service/ConsoleLogger";

import { DefaultLoggerPublisherService } from "./DefaultLoggerPublisherService";

jest.mock("@api/logger-subscriber/service/ConsoleLogger");
jest.useFakeTimers().setSystemTime(new Date("2024-01-01"));

let service: DefaultLoggerPublisherService;
let subscriber: jest.Mocked<ConsoleLogger>;
const message = "message";
const tag = "logger-tag";
const options = { data: { key: "value" } };
const generatedOptions = { tag, timestamp: Date.now(), ...options };

describe("LoggerPublisherService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriber = new ConsoleLogger() as jest.Mocked<ConsoleLogger>;
    service = new DefaultLoggerPublisherService([subscriber], tag);
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

  it("should call subscriber.log with the correct log object when a timestamp is provided", () => {
    const newTimestamp = 1;
    service.info(message, { ...options, timestamp: newTimestamp });
    expect(subscriber.log).toHaveBeenCalledWith(LogLevel.Info, message, {
      ...generatedOptions,
      timestamp: newTimestamp,
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

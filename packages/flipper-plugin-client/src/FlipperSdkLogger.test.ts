import { LogLevel, LogParams } from "@ledgerhq/device-management-kit";

import { FlipperObjLog, FlipperSdkLogger } from "./FlipperSdkLogger";

const testLogs: LogParams[] = [
  [
    LogLevel.Debug,
    "Test info log",
    {
      timestamp: 0,
      tag: "test",
      data: { key: "value" },
    },
  ],
  [
    LogLevel.Info,
    "Test info log",
    {
      timestamp: 1,
      tag: "test",
      data: {
        unstringifiable: {
          toJSON() {
            throw Error("cannot stringify");
          },
        },
      },
    },
  ],
  [
    LogLevel.Warning,
    "Test warning log",
    {
      timestamp: 2,
      tag: "test",
      data: { key: "value" },
    },
  ],
  [
    LogLevel.Error,
    "Test error log",
    {
      timestamp: 3,
      tag: "test",
      data: { key: "value" },
    },
  ],
  [
    LogLevel.Fatal,
    "Test fatal log",
    {
      timestamp: 4,
      tag: "test",
      data: { key: "value" },
    },
  ],
];

const expectedFlipperLogs: FlipperObjLog[] = [
  {
    timestamp: "1970-01-01T00:00:00.000Z",
    tag: "test",
    verbosity: "debug",
    message: "Test info log",
    payloadJSON: '{"key":"value"}',
  },
  {
    timestamp: "1970-01-01T00:00:00.001Z",
    tag: "test",
    verbosity: "info",
    message: "Test info log",
    payloadJSON: "",
  },
  {
    timestamp: "1970-01-01T00:00:00.002Z",
    tag: "test",
    verbosity: "warning",
    message: "Test warning log",
    payloadJSON: '{"key":"value"}',
  },
  {
    timestamp: "1970-01-01T00:00:00.003Z",
    tag: "test",
    verbosity: "error",
    message: "Test error log",
    payloadJSON: '{"key":"value"}',
  },
  {
    timestamp: "1970-01-01T00:00:00.004Z",
    tag: "test",
    verbosity: "fatal",
    message: "Test fatal log",
    payloadJSON: '{"key":"value"}',
  },
];

describe("FlipperSdkLogger", () => {
  test("subscribeToLogs should return a subscription emitting all the logs, formatted", () => {
    const logger = new FlipperSdkLogger();

    // Logs emitted before the subscription
    for (const log of testLogs.slice(0, 2)) {
      logger.log(...log);
    }

    const observedLogs: FlipperObjLog[] = [];
    logger.subscribeToLogs((log) => observedLogs.push(log));

    // Logs emitted after the subscription
    for (const log of testLogs.slice(2)) {
      logger.log(...log);
    }

    console.log(observedLogs);
    expect(observedLogs).toEqual(expectedFlipperLogs);
  });
});

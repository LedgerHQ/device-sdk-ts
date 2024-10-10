import { LogLevel, LogParams } from "@ledgerhq/device-management-kit";
import { type FlipperPluginConnection } from "js-flipper";

import { FlipperPluginManager } from "./FlipperPluginManager";
import { FlipperObjLog, FlipperSdkLogger } from "./FlipperSdkLogger";

jest.mock("js-flipper");

const testLogs: LogParams[] = [
  [
    LogLevel.Debug,
    "Test info log",
    {
      timestamp: 0,
      tag: "test",
      data: { apdu: new Uint8Array([0xb0, 0x01, 0x00, 0x00]) },
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
    payloadJSON:
      '{"apdu":{"hex":"0xb0010000","readableHex":"b0 01 00 00","value":[176,1,0,0]}}',
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
const expectedFlipperMessages = expectedFlipperLogs.map((log) => ({
  method: "addLog",
  params: log,
}));

describe("FlipperSdkLogger", () => {
  beforeEach(() => {});
  test("subscribeToLogs should return a subscription emitting all the logs, formatted", () => {
    const flipperPluginManager = FlipperPluginManager.getInstance();

    const logger = new FlipperSdkLogger(flipperPluginManager);

    // Logs emitted before a Flipper connection is established
    for (const log of testLogs.slice(0, 2)) {
      logger.log(...log);
    }

    const observedFlipperMessages: { method: string; params?: unknown }[] = [];

    // Flipper connection established
    const mockedFlipperConnection: FlipperPluginConnection = {
      send: (method: string, params?: unknown) => {
        if (method === "init") return; // ignore this
        observedFlipperMessages.push({ method, params });
      },
      receive: () => {},
    };
    flipperPluginManager.onConnect(mockedFlipperConnection);

    // Logs emitted after a Flipper connection is established
    for (const log of testLogs.slice(2)) {
      logger.log(...log);
    }

    expect(observedFlipperMessages).toEqual(expectedFlipperMessages);
  });
});

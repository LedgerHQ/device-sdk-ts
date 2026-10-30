import { mapConnectorMessageToLogData } from "./mapConnectorMessageToLogData";

const message = (payloadJSON: string) =>
  JSON.stringify({
    timestamp: "2026-01-01T00:00:00.000Z",
    tag: "t",
    verbosity: "info",
    message: "m",
    payloadJSON,
  });

const payloadOf = (payloadJSON: string) =>
  mapConnectorMessageToLogData(message(payloadJSON))?.payload;

describe("mapConnectorMessageToLogData", () => {
  it("keeps object and string payloads", () => {
    expect(payloadOf('{"a":1}')).toEqual({ a: 1 });
    expect(payloadOf('"text"')).toBe("text");
  });

  it("turns a null payload into an empty object", () => {
    expect(payloadOf("null")).toEqual({});
  });

  it("turns other values and unreadable JSON into text", () => {
    expect(payloadOf("42")).toBe("42");
    expect(payloadOf("{oops")).toBe("{oops");
  });

  it("ignores a message that is not a log", () => {
    expect(mapConnectorMessageToLogData("not json")).toBeNull();
  });

  it("gives a log without payloadJSON an empty payload", () => {
    const log = mapConnectorMessageToLogData(
      JSON.stringify({
        timestamp: "2026-01-01T00:00:00.000Z",
        tag: "t",
        verbosity: "info",
        message: "m",
      }),
    );
    expect(log?.payload).toEqual({});
    expect(log?.payloadJSON).toBe("{}");
  });

  it.each([
    [{ tag: "t", verbosity: "info", message: "m" }, "no timestamp"],
    [{ timestamp: "x", verbosity: "info", message: "m" }, "no tag"],
    [{ timestamp: "x", tag: "t", verbosity: "info" }, "no message"],
    [
      { timestamp: "x", tag: "t", verbosity: "loud", message: "m" },
      "an unknown verbosity",
    ],
    [
      {
        timestamp: "x",
        tag: "t",
        verbosity: "info",
        message: "m",
        payloadJSON: 1,
      },
      "a payloadJSON that is not text",
    ],
    [null, "null"],
  ] as [unknown, string][])("rejects a message with %j (%s)", (value) => {
    expect(mapConnectorMessageToLogData(JSON.stringify(value))).toBeNull();
  });
});

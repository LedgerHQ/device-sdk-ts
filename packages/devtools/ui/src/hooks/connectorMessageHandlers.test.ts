import {
  handleApduResponse,
  handleLogMessage,
  handleMockServerConfig,
  handleModuleConnected,
  parseMockServerConfig,
} from "./connectorMessageHandlers";

describe("parseMockServerConfig", () => {
  it("accepts a URL with or without a session token", () => {
    expect(parseMockServerConfig('{"url":"http://localhost:9752"}')).toEqual({
      url: "http://localhost:9752",
    });
    expect(
      parseMockServerConfig(
        '{"url":"http://localhost:9752","sessionToken":"t"}',
      ),
    ).toEqual({ url: "http://localhost:9752", sessionToken: "t" });
  });

  it("accepts null, which clears a previous app's mock server", () => {
    expect(parseMockServerConfig("null")).toBeNull();
  });

  it.each([
    ['{"url":"http://localhost:9752","sessionToken":42}', "a non-string token"],
    ['{"url":42}', "a non-string URL"],
    ["{}", "a missing URL"],
    ['"http://localhost:9752"', "a bare string"],
    ["not json", "invalid JSON"],
    ['{"url":"http://","sessionToken":"t"}', "a URL without a host"],
    ['{"url":"ftp://h"}', "a URL that is not HTTP"],
    ['{"url":"not a url"}', "a string that is not a URL"],
  ])("rejects %s (%s)", (payload) => {
    expect(parseMockServerConfig(payload)).toBeUndefined();
  });

  it("drops fields it does not know", () => {
    expect(
      parseMockServerConfig('{"url":"http://h","sessionToken":"t","extra":1}'),
    ).toEqual({ url: "http://h", sessionToken: "t" });
  });
});

describe("handleMockServerConfig", () => {
  it("stores a valid config and ignores an invalid one", () => {
    const setMockServer = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    handleMockServerConfig('{"url":"http://h"}', setMockServer);
    handleMockServerConfig('{"url":1}', setMockServer);
    expect(setMockServer).toHaveBeenCalledTimes(1);
    expect(setMockServer).toHaveBeenCalledWith({ url: "http://h" });
  });
});

describe("handleApduResponse", () => {
  it("adds the response under its request id", () => {
    let responses = new Map();
    const setResponses = (
      update: (previous: typeof responses) => typeof responses,
    ) => {
      responses = update(responses);
    };
    handleApduResponse(
      '{"requestId":"r1","success":true,"statusCode":[144,0],"data":[1]}',
      setResponses as never,
    );
    expect(responses.get("r1")).toEqual({
      requestId: "r1",
      success: true,
      statusCode: [144, 0],
      data: [1],
    });
  });
});

describe("handleModuleConnected", () => {
  it("adds the module to the connected ones", () => {
    let modules = new Set<string>();
    handleModuleConnected('{"module":"logger"}', ((
      update: (previous: Set<string>) => Set<string>,
    ) => {
      modules = update(modules);
    }) as never);
    expect([...modules]).toEqual(["logger"]);
  });
});

describe("handleLogMessage", () => {
  it("adds a log with its parsed payload", () => {
    const addLog = vi.fn();
    const handled = handleLogMessage(
      JSON.stringify({
        timestamp: "2026-01-01T00:00:00.000Z",
        tag: "t",
        verbosity: "info",
        message: "m",
        payloadJSON: '{"a":1}',
      }),
      addLog,
    );
    expect(handled).toBe(true);
    expect(addLog).toHaveBeenCalledWith(
      expect.objectContaining({ message: "m", payload: { a: 1 } }),
    );
  });
});

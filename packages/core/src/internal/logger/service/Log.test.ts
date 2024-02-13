import { Log, LogLevel } from "./Log";

describe("Log", () => {
  it("should create a Log instance", () => {
    const log = new Log({ messages: ["test"], data: {}, context: {} });
    expect(log).toBeInstanceOf(Log);
  });

  it("should set the level", () => {
    const log = new Log({
      messages: ["test"],
      data: {},
      context: {},
      level: LogLevel.Info,
    });
    expect(log.level).toBe(LogLevel.Info);
    log.setLevel(LogLevel.Debug);
    expect(log.level).toBe(LogLevel.Debug);
  });

  it("should add a message", () => {
    const log = new Log({ messages: ["test"], data: {}, context: {} });
    log.addMessage("test2");
    expect(log.messages).toEqual(["test", "test2"]);
  });
});

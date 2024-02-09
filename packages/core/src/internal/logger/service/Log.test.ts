import { Log } from "./Log";

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
      level: 1,
    });
    expect(log.level).toBe(1);
    log.setLevel(2);
    expect(log.level).toBe(2);
  });

  it("should add a message", () => {
    const log = new Log({ messages: ["test"], data: {}, context: {} });
    log.addMessage("test2");
    expect(log.messages).toEqual(["test", "test2"]);
  });
});

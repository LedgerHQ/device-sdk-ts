import { Log } from "./Log";

describe("Log", () => {
  it("should create a Log instance", () => {
    const log = new Log({ messages: ["test"], data: {}, context: {} });
    expect(log).toBeInstanceOf(Log);
  });

  it("should add a message", () => {
    const log = new Log({ messages: ["test"], data: {}, context: {} });
    log.addMessage("test2");
    expect(log.messages).toEqual(["test", "test2"]);
  });
});

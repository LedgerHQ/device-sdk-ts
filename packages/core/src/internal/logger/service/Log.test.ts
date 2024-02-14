import { Log } from "./Log";

const d = jest.spyOn(Date, "now").mockReturnValue(12346);

describe("Log", () => {
  beforeEach(() => {
    d.mockClear();
  });

  it("should create a Log instance", () => {
    const log = new Log({
      messages: ["test"],
      data: {},
      context: {},
    });
    expect(log).toBeInstanceOf(Log);
  });

  it("should have the correct timestamp", () => {
    const log = new Log({
      messages: ["test"],
      data: {},
      context: {},
    });
    expect(log.timestamp).toBe(12346);
  });

  it("should add a message", () => {
    const log = new Log({
      messages: ["test"],
      data: {},
      context: {},
    });
    log.addMessage("test2");
    expect(log.messages).toEqual(["test", "test2"]);
  });
});

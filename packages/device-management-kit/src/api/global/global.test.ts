import { LogLevel } from "@api/global/services/logger/model/LogLevel";

describe("ctx", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should publish ctx.service.logger logs to the registered subscribers", async () => {
    const { ctx } = await import("./global");
    const subscriber = { log: vi.fn() };
    ctx.service.logger.setSubscribers([subscriber]);

    ctx.service.logger.getLogger("SignerEth", "Task").info("hello");

    expect(subscriber.log).toHaveBeenCalledWith(
      LogLevel.Info,
      "hello",
      expect.objectContaining({ tags: ["SignerEth", "Task"] }),
    );
  });

  it("should report a double registration and keep the first context", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ctx: first } = await import("./global");
    error.mockClear();

    vi.resetModules();
    const { ctx: second } = await import("./global");

    expect(error).toHaveBeenCalledOnce();
    expect(second).toBe(first);
    error.mockRestore();
  });
});

import { LogLevel } from "@api/global/services/logger/model/LogLevel";

import { getLogger, setLoggerSubscribers } from "./getLogger";

describe("getLogger", () => {
  it("should publish its tags to the subscribers", () => {
    const subscriber = { log: vi.fn() };
    setLoggerSubscribers([subscriber]);

    getLogger("SignerEth", "SignTransactionTask").info("hello", {
      data: { a: 1 },
    });

    expect(subscriber.log).toHaveBeenCalledWith(LogLevel.Info, "hello", {
      tag: "[SignerEth] [SignTransactionTask]",
      tags: ["SignerEth", "SignTransactionTask"],
      timestamp: expect.any(Number) as number,
      data: { a: 1 },
    });
  });

  it("should reach subscribers set after the logger was created", () => {
    setLoggerSubscribers([]);
    const logger = getLogger("Early");
    const subscriber = { log: vi.fn() };

    setLoggerSubscribers([subscriber]);
    logger.debug("kept");

    expect(subscriber.log).toHaveBeenCalledTimes(1);
  });
});

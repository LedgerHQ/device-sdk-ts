import { ConsoleLogger } from "./global/services/logger/ConsoleLogger";
import { type LogParams } from "./global/services/logger/LoggerSubscriberService";
import { LogLevel } from "./global/services/logger/model/LogLevel";
import { getLogger } from "./global/services/logger/utils/getLogger";
import { DeviceManagementKit } from "./DeviceManagementKit";
import { DeviceManagementKitBuilder } from "./DeviceManagementKitBuilder";

vi.mock("./global/services/logger/ConsoleLogger");

let builder: DeviceManagementKitBuilder;
let logger: ConsoleLogger;

describe("LedgerDeviceManagementKitBuilder", () => {
  beforeEach(() => {
    builder = new DeviceManagementKitBuilder();
  });

  it("should build a DeviceManagementKit instance", () => {
    const dmk: DeviceManagementKit = builder.build();
    expect(dmk).toBeInstanceOf(DeviceManagementKit);
  });

  it("should set the stub flag", () => {
    builder.setStub(true);
    // @ts-expect-error Access private field stub
    expect(builder.stub).toBe(true);
  });

  it("should add a logger", () => {
    logger = new ConsoleLogger();
    builder.addLogger(logger);
    // @ts-expect-error Access private field loggers
    expect(builder.loggers).toContain(logger);
  });

  it("should send getLogger logs to the added loggers", () => {
    const subscriber = { log: vi.fn<(...params: LogParams) => void>() };
    builder.addLogger(subscriber).build();

    getLogger("SignerEth", "SignTransactionTask").info("hello");

    expect(subscriber.log).toHaveBeenCalledWith(
      LogLevel.Info,
      "hello",
      expect.objectContaining({
        tag: "[SignerEth] [SignTransactionTask]",
        tags: ["SignerEth", "SignTransactionTask"],
      }),
    );
  });

  it("should default mockUrl to the hosted mock server", () => {
    // @ts-expect-error Access private field config
    expect(builder.config.mockUrl).toBe(
      "https://device-mock-server.aws.ldg-ps-default.ldg-tech.com",
    );
  });
});

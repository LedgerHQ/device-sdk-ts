import { ConsoleLogger } from "./logger-subscriber/service/ConsoleLogger";
import { DeviceSdk } from "./DeviceSdk";
import { LedgerDeviceSdkBuilder } from "./DeviceSdkBuilder";

jest.mock("./logger-subscriber/service/ConsoleLogger");

let builder: LedgerDeviceSdkBuilder;
let logger: ConsoleLogger;

describe("LedgerDeviceSdkBuilder", () => {
  beforeEach(() => {
    builder = new LedgerDeviceSdkBuilder();
  });

  it("should build a DeviceSdk instance", () => {
    const sdk: DeviceSdk = builder.build();
    expect(sdk).toBeInstanceOf(DeviceSdk);
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
});

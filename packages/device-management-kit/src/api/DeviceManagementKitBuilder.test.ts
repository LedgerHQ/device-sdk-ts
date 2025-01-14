import { ConsoleLogger } from "./logger-subscriber/service/ConsoleLogger";
import { DeviceManagementKit } from "./DeviceManagementKit";
import { DeviceManagementKitBuilder } from "./DeviceManagementKitBuilder";

vi.mock("./logger-subscriber/service/ConsoleLogger");

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
});

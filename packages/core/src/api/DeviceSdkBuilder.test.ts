import { DeviceSdk } from "./DeviceSdk";
import { LedgerDeviceSdkBuilder } from "./DeviceSdkBuilder";

let builder: LedgerDeviceSdkBuilder;
const logger = {
  log: jest.fn(),
};

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
    expect(builder.stub).toBe(true);
  });

  it("should add a logger", () => {
    builder.addLogger(logger);
    expect(builder.loggers).toContain(logger);
  });
});

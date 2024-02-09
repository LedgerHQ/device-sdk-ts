import { LoggerSubscriber } from "@internal/logger/service/Log";

import { DeviceSdk } from "./DeviceSdk";

export class LedgerDeviceSdkBuilder {
  stub = false;
  loggers: LoggerSubscriber[] = [];
  constructor() {
    console.log("New build");
  }

  build(): DeviceSdk {
    return new DeviceSdk({ stub: this.stub, loggers: this.loggers });
  }

  setStub(stubbed = true): LedgerDeviceSdkBuilder {
    this.stub = stubbed;
    return this;
  }

  addLogger(logger: LoggerSubscriber): LedgerDeviceSdkBuilder {
    this.loggers.push(logger);
    return this;
  }
}

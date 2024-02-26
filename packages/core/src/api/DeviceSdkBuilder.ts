import { LoggerSubscriberService } from "./logger-subscriber/service/LoggerSubscriberService";
import { DeviceSdk } from "./DeviceSdk";

export class LedgerDeviceSdkBuilder {
  stub = false;
  loggers: LoggerSubscriberService[] = [];

  build(): DeviceSdk {
    return new DeviceSdk({ stub: this.stub, loggers: this.loggers });
  }

  setStub(stubbed: boolean): LedgerDeviceSdkBuilder {
    this.stub = stubbed;
    return this;
  }

  addLogger(logger: LoggerSubscriberService): LedgerDeviceSdkBuilder {
    this.loggers.push(logger);
    return this;
  }
}

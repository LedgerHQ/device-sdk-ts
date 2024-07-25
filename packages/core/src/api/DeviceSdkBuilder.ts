import { LoggerSubscriberService } from "./logger-subscriber/service/LoggerSubscriberService";
import { DeviceSdk } from "./DeviceSdk";

/**
 * Builder for the `DeviceSdk` class.
 *
 * @example
 * ```
 * const sdk = new LedgerDeviceSdkBuilder()
 *  .setStub(false)
 *  .addLogger(myLogger)
 *  .build();
 * ```
 */
export class LedgerDeviceSdkBuilder {
  private stub = false;
  private readonly loggers: LoggerSubscriberService[] = [];

  build(): DeviceSdk {
    return new DeviceSdk({ stub: this.stub, loggers: this.loggers });
  }

  setStub(stubbed: boolean): LedgerDeviceSdkBuilder {
    this.stub = stubbed;
    return this;
  }

  /**
   * Add a logger to the SDK that will receive its logs
   */
  addLogger(logger: LoggerSubscriberService): LedgerDeviceSdkBuilder {
    this.loggers.push(logger);
    return this;
  }
}

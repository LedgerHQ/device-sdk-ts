import { TransportBuilder } from "@api/transport/model/TransportBuilder";
import { DEFAULT_MANAGER_API_BASE_URL } from "@internal/manager-api/model/Const";

import { LoggerSubscriberService } from "./logger-subscriber/service/LoggerSubscriberService";
import { Transport } from "./transport/model/Transport";
import { DeviceSdk } from "./DeviceSdk";
import { SdkConfig } from "./SdkConfig";

/**
 * Builder for the `DeviceSdk` class.
 *
 * @example
 * ```
 * const sdk = new LedgerDeviceSdkBuilder()
 *  .setStub(false)
 *  .addTransport(BuiltinTransports.USB)
 *  .addCustomTransport(new MyTransport())
 *  .addLogger(myLogger)
 *  .build();
 * ```
 */
export class LedgerDeviceSdkBuilder {
  private stub = false;
  private readonly loggers: LoggerSubscriberService[] = [];
  private readonly transportBuilders: TransportBuilder<Transport>[] = [];
  private config: SdkConfig = {
    managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
  };

  build(): DeviceSdk {
    return new DeviceSdk({
      stub: this.stub,
      transportBuilders: this.transportBuilders,
      loggers: this.loggers,
      config: this.config,
    });
  }

  setStub(stubbed: boolean): LedgerDeviceSdkBuilder {
    this.stub = stubbed;
    return this;
  }

  addTransportBuilder<T extends Transport>(
    transport: TransportBuilder<T>,
  ): LedgerDeviceSdkBuilder {
    this.transportBuilders.push(transport);
    return this;
  }

  /**
   * Add a logger to the SDK that will receive its logs
   */
  addLogger(logger: LoggerSubscriberService): LedgerDeviceSdkBuilder {
    this.loggers.push(logger);
    return this;
  }

  addConfig(config: Partial<SdkConfig>): LedgerDeviceSdkBuilder {
    this.config = {
      ...this.config,
      ...config,
    };
    return this;
  }
}

import {
  DEFAULT_MANAGER_API_BASE_URL,
  DEFAULT_MOCK_SERVER_BASE_URL,
} from "@internal/manager-api/model/Const";

import { type LoggerSubscriberService } from "./logger-subscriber/service/LoggerSubscriberService";
import { type Transport } from "./transport/model/Transport";
import { type BuiltinTransports } from "./transport/model/TransportIdentifier";
import { DeviceManagementKit } from "./DeviceManagementKit";
import { type DmkConfig } from "./DmkConfig";

/**
 * Builder for the `DeviceManagementKit` class.
 *
 * @example
 * ```
 * const dmk = new LedgerDeviceManagementKitBuilder()
 *  .setStub(false)
 *  .addTransport(BuiltinTransports.USB)
 *  .addCustomTransport(new MyTransport())
 *  .addLogger(myLogger)
 *  .build();
 * ```
 */
export class DeviceManagementKitBuilder {
  private stub = false;
  private readonly loggers: LoggerSubscriberService[] = [];
  private readonly transports: BuiltinTransports[] = [];
  private readonly customTransports: Transport[] = [];
  private config: DmkConfig = {
    managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
    mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
  };

  build(): DeviceManagementKit {
    return new DeviceManagementKit({
      stub: this.stub,
      transports: this.transports,
      customTransports: this.customTransports,
      loggers: this.loggers,
      config: this.config,
    });
  }

  setStub(stubbed: boolean): DeviceManagementKitBuilder {
    this.stub = stubbed;
    return this;
  }

  addTransport(transport: BuiltinTransports): DeviceManagementKitBuilder {
    this.transports.push(transport);
    return this;
  }

  addCustomTransport(transport: Transport): DeviceManagementKitBuilder {
    this.customTransports.push(transport);
    return this;
  }

  /**
   * Add a logger to the SDK that will receive its logs
   */
  addLogger(logger: LoggerSubscriberService): DeviceManagementKitBuilder {
    this.loggers.push(logger);
    return this;
  }

  addConfig(config: Partial<DmkConfig>): DeviceManagementKitBuilder {
    this.config = {
      ...this.config,
      ...config,
    };
    return this;
  }
}

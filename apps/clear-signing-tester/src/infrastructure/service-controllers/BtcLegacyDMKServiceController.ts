import {
  DeviceManagementKit,
  DeviceManagementKitBuilder,
  DiscoveredDevice,
  LoggerPublisherService,
  type LoggerSubscriberService,
} from "@ledgerhq/device-management-kit";
import {
  type BtcLegacyErrorCodes,
  type LegacyCoinProfile,
  SignerBtcLegacyBuilder,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { inject } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { getEmulatorBaseUrl } from "@root/src/domain/utils/getEmulatorBaseUrl";
import { BtcLegacySigningService } from "@root/src/infrastructure/services/BtcLegacySigningService";

/**
 * DMK controller for the coin apps on the legacy Bitcoin protocol. The coin is
 * the profile the container binds, so one controller serves every such app.
 */
export class BtcLegacyDMKServiceController implements ServiceController {
  private logger: LoggerPublisherService;
  private dmk: DeviceManagementKit | null = null;
  private sessionId: string | null = null;
  private readonly loggerSubscribers: LoggerSubscriberService[];

  constructor(
    @inject(TYPES.SigningService)
    private readonly signingService: BtcLegacySigningService,
    @inject(TYPES.BtcLegacyProfile)
    private readonly profile: LegacyCoinProfile<BtcLegacyErrorCodes>,
    @inject(TYPES.RetryService)
    private readonly retryService: RetryService,
    @inject(TYPES.SpeculinhoConfig)
    private readonly speculosConfig: SpeculinhoConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.LoggerSubscribers)
    loggerSubscribers: LoggerSubscriberService[],
  ) {
    this.logger = loggerFactory("btc-legacy-dmk-service-controller");
    this.loggerSubscribers = loggerSubscribers;
  }

  private buildDmk(): DeviceManagementKit {
    const dmkBuilder = new DeviceManagementKitBuilder().addTransport(
      speculosTransportFactory(getEmulatorBaseUrl(this.speculosConfig), true),
    );
    for (const subscriber of this.loggerSubscribers) {
      dmkBuilder.addLogger(subscriber);
    }
    return dmkBuilder.build();
  }

  async start(): Promise<void> {
    this.logger.info(`Starting ${this.profile.appName} DMK`);

    this.dmk = this.buildDmk();

    await this.retryService.retryUntilSuccess(
      async () => {
        return new Promise<void>((resolve, reject) => {
          this.logger.debug("Attempting to discover and connect to device");
          this.dmk!.startDiscovering({
            transport: speculosIdentifier,
          }).subscribe({
            next: (device: DiscoveredDevice) => {
              this.dmk!.connect({
                device: device,
                sessionRefresherOptions: {
                  isRefresherDisabled: true,
                },
              })
                .then((sessionId: string) => {
                  this.sessionId = sessionId;
                  this.logger.debug("Device connected", {
                    data: { sessionId: this.sessionId },
                  });
                  this.signingService.setSigner(
                    new SignerBtcLegacyBuilder({
                      dmk: this.dmk!,
                      sessionId,
                      profile: this.profile,
                    }).build(),
                  );

                  resolve();
                })
                .catch((error: Error) => {
                  this.logger.debug("Failed to connect to device", {
                    data: { error },
                  });
                  reject(error);
                });
            },
            error: (error: Error) => {
              this.logger.debug("Error during device discovery", {
                data: { error },
              });
              reject(error);
            },
          });
        });
      },
      5,
      10000,
    );

    this.logger.info(`${this.profile.appName} DMK started successfully`);
  }

  async stop(): Promise<void> {
    this.logger.debug(`Stopping ${this.profile.appName} DMK`);
    if (this.sessionId && this.dmk) {
      await this.dmk.disconnect({ sessionId: this.sessionId });
    }
  }
}

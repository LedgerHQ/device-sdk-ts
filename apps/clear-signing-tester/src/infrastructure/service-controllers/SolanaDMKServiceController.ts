import { ContextModule, ContextModuleBuilder } from "@ledgerhq/context-module";
import {
  DeviceManagementKit,
  DeviceManagementKitBuilder,
  DiscoveredDevice,
  LoggerPublisherService,
  type LoggerSubscriberService,
} from "@ledgerhq/device-management-kit";
import {
  type SignerSolana,
  SignerSolanaBuilder,
} from "@ledgerhq/device-signer-kit-solana";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { inject } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type CalConfig } from "@root/src/domain/models/config/CalConfig";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { SolanaSigningService } from "@root/src/infrastructure/services/SolanaSigningService";

export class SolanaDMKServiceController implements ServiceController {
  private logger: LoggerPublisherService;
  private dmk: DeviceManagementKit;
  private contextModule: ContextModule;
  private sessionId: string | null = null;
  private signer: SignerSolana | null = null;

  constructor(
    @inject(TYPES.SigningService)
    private readonly signingService: SolanaSigningService,
    @inject(TYPES.RetryService)
    private readonly retryService: RetryService,
    @inject(TYPES.SpeculosConfig)
    private readonly speculosConfig: SpeculosConfig,
    @inject(TYPES.SignerConfig)
    private readonly signerConfig: SignerConfig,
    @inject(TYPES.CalConfig)
    private readonly calConfig: CalConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.LoggerSubscribers)
    loggerSubscribers: LoggerSubscriberService[],
  ) {
    this.logger = loggerFactory("solana-dmk-service-controller");

    const dmkBuilder = new DeviceManagementKitBuilder().addTransport(
      speculosTransportFactory(
        `${this.speculosConfig.url}:${this.speculosConfig.port}`,
      ),
    );

    for (const subscriber of loggerSubscribers) {
      dmkBuilder.addLogger(subscriber);
    }

    this.dmk = dmkBuilder.build();
    this.contextModule = new ContextModuleBuilder({
      originToken: this.signerConfig.originToken,
      loggerFactory: (tag: string) =>
        this.dmk.getLoggerFactory()(["ContextModule", tag]),
    })
      .setDatasourceConfig({ proxy: "safe" })
      .setCalConfig(this.calConfig)
      .build();
  }

  async start(): Promise<void> {
    this.logger.info("Starting Solana DMK");

    await this.retryService.retryUntilSuccess(
      async () => {
        return new Promise<void>((resolve, reject) => {
          this.logger.debug("Attempting to discover and connect to device");
          this.dmk
            .startDiscovering({ transport: speculosIdentifier })
            .subscribe({
              next: (device: DiscoveredDevice) => {
                this.dmk
                  .connect({
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
                    this.signer = new SignerSolanaBuilder({
                      dmk: this.dmk,
                      sessionId: sessionId,
                      originToken: this.signerConfig.originToken,
                    })
                      .withContextModule(this.contextModule)
                      .build();

                    this.signingService.setSigner(this.signer);

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

    this.logger.info("Solana DMK started successfully");
  }

  async stop(): Promise<void> {
    this.logger.debug("Stopping Solana DMK");
    if (this.sessionId) {
      await this.dmk.disconnect({ sessionId: this.sessionId });
    }
  }
}

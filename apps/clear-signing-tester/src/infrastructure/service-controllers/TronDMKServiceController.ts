import {
  ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  ContactsManagerBuilder,
  TRON_APP_NAME,
} from "@ledgerhq/device-contacts-kit";
import {
  DeviceManagementKit,
  DeviceManagementKitBuilder,
  DiscoveredDevice,
  LoggerPublisherService,
  type LoggerSubscriberService,
} from "@ledgerhq/device-management-kit";
import {
  type SignerTrx,
  SignerTrxBuilder,
} from "@ledgerhq/device-signer-kit-tron";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { inject } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type CalConfig } from "@root/src/domain/models/config/CalConfig";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { getEmulatorBaseUrl } from "@root/src/domain/utils/getEmulatorBaseUrl";
import { SpeculosContactsRepository } from "@root/src/infrastructure/repositories/SpeculosContactsRepository";
import { TronSigningService } from "@root/src/infrastructure/services/TronSigningService";

export class TronDMKServiceController implements ServiceController {
  private logger: LoggerPublisherService;
  private dmk: DeviceManagementKit | null = null;
  private contextModule: ContextModule | null = null;
  private sessionId: string | null = null;
  private signer: SignerTrx | null = null;
  private readonly loggerSubscribers: LoggerSubscriberService[];

  constructor(
    @inject(TYPES.SigningService)
    private readonly signingService: TronSigningService,
    @inject(TYPES.SpeculosContactsRepository)
    private readonly contactsRepository: SpeculosContactsRepository,
    @inject(TYPES.RetryService)
    private readonly retryService: RetryService,
    @inject(TYPES.SpeculinhoConfig)
    private readonly speculosConfig: SpeculinhoConfig,
    @inject(TYPES.SignerConfig)
    private readonly signerConfig: SignerConfig,
    @inject(TYPES.CalConfig)
    private readonly calConfig: CalConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.LoggerSubscribers)
    loggerSubscribers: LoggerSubscriberService[],
  ) {
    this.logger = loggerFactory("tron-dmk-service-controller");
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

  private buildContextModule(dmk: DeviceManagementKit): ContextModule {
    return new ContextModuleBuilder({
      originToken: this.signerConfig.originToken,
      loggerFactory: (tag: string) =>
        dmk.getLoggerFactory()(["ContextModule", tag]),
    })
      .setDatasourceConfig({ proxy: "safe" })
      .setCalConfig(this.calConfig)
      .setChain(ContextModuleChainID.Tron)
      .build();
  }

  async start(): Promise<void> {
    this.logger.info("Starting Tron DMK");

    this.dmk = this.buildDmk();
    this.contextModule = this.buildContextModule(this.dmk);

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
                  this.contactsRepository.setContactsManager(
                    new ContactsManagerBuilder({
                      dmk: this.dmk!,
                      sessionId,
                      appName: TRON_APP_NAME,
                    }).build(),
                  );
                  this.buildSigner(sessionId);

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

    this.logger.info("Tron DMK started successfully");
  }

  private buildSigner(sessionId: string): void {
    const builder = new SignerTrxBuilder({
      dmk: this.dmk!,
      sessionId,
      originToken: this.signerConfig.originToken,
    }).withContextModule(this.contextModule!);

    const { tronAddressBook } = this.signerConfig;
    if (tronAddressBook) {
      builder.withAddressBook(tronAddressBook);
    }

    this.signer = builder.build();
    this.signingService.setSigner(this.signer);

    this.logger.debug("Signer built", {
      data: { contactGroups: tronAddressBook?.contactGroups.length ?? 0 },
    });
  }

  async stop(): Promise<void> {
    this.logger.debug("Stopping Tron DMK");
    if (this.sessionId && this.dmk) {
      await this.dmk.disconnect({ sessionId: this.sessionId });
    }
  }
}

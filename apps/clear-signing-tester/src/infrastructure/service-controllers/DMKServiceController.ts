import { ContextModule, ContextModuleBuilder } from "@ledgerhq/context-module";
import {
    DeviceManagementKit,
    DeviceManagementKitBuilder,
    DiscoveredDevice,
    LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
    SignerEth,
    SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";
import {
    speculosIdentifier,
    speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { inject } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type ServiceController } from "@root/src/domain/services/ServiceController";
import { type SigningService } from "@root/src/domain/services/SigningService";

export class DMKServiceController implements ServiceController {
    private logger: LoggerPublisherService;
    private dmk: DeviceManagementKit;
    private contextModule: ContextModule;
    private sessionId: string | null = null;
    private signer: SignerEth | null = null;

    constructor(
        @inject(TYPES.SigningService)
        private readonly signingService: SigningService,
        @inject(TYPES.SpeculosConfig)
        private readonly speculosConfig: SpeculosConfig,
        @inject(TYPES.SignerConfig)
        private readonly signerConfig: SignerConfig,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = loggerFactory("dmk-service-controller");
        this.dmk = new DeviceManagementKitBuilder()
            .addTransport(
                speculosTransportFactory(
                    `${this.speculosConfig.url}:${this.speculosConfig.port}`,
                ),
            )
            .build();
        this.contextModule = new ContextModuleBuilder({
            originToken: this.signerConfig.originToken,
        })
            .setDatasourceConfig({ proxy: "safe" })
            .build();
    }

    async start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.logger.debug("Starting DMK");
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
                                this.signer = new SignerEthBuilder({
                                    dmk: this.dmk,
                                    sessionId: sessionId,
                                    originToken: this.signerConfig.originToken,
                                })
                                    .withContextModule(this.contextModule)
                                    .build();

                                this.signingService.setSigner(this.signer);

                                resolve();
                            });
                    },
                    error: (error: Error) => {
                        this.logger.error("Error connecting to device", {
                            data: { error },
                        });
                        reject(error);
                    },
                });
        });
    }

    async stop(): Promise<void> {
        this.logger.debug("Stopping DMK");
        if (this.sessionId) {
            await this.dmk.disconnect({ sessionId: this.sessionId });
        }
    }
}

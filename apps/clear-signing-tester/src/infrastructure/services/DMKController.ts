import { TYPES } from "@root/src/di/types";
import { SpeculosSigningService } from "./SpeculosSigningService";
import { inject } from "inversify";
import {
    type SignerConfig,
    type DeviceConnectionConfig,
} from "@root/src/domain/repositories/DeviceRepository";
import {
    DeviceManagementKit,
    DeviceManagementKitBuilder,
    LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
    speculosIdentifier,
    speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { ContextModule, ContextModuleBuilder } from "@ledgerhq/context-module";
import {
    SignerEth,
    SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

export interface Controller {
    start(): Promise<void>;
    stop(): Promise<void>;
}

export class DMKController implements Controller {
    private logger: LoggerPublisherService;
    private dmk: DeviceManagementKit;
    private contextModule: ContextModule;
    private sessionId: string | null = null;
    private signer: SignerEth | null = null;

    constructor(
        @inject(TYPES.SpeculosSigningService)
        private readonly speculosSigningService: SpeculosSigningService,
        @inject(TYPES.DeviceConnectionConfig)
        private readonly deviceConfig: DeviceConnectionConfig,
        @inject(TYPES.SignerConfig)
        private readonly signerConfig: SignerConfig,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = loggerFactory("dmk-controller");
        this.dmk = new DeviceManagementKitBuilder()
            .addTransport(
                speculosTransportFactory(this.deviceConfig.speculosUrl),
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
                    next: (device: any) => {
                        this.dmk
                            .connect({
                                device: device,
                                sessionRefresherOptions: this.deviceConfig
                                    .sessionRefresherOptions || {
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

                                this.speculosSigningService.setSigner(
                                    this.signer,
                                );

                                resolve();
                            });
                    },
                    error: (error: any) => {
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

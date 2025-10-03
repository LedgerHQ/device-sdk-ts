import { Controller } from "@root/src/domain/services/Controller";
import { TYPES } from "@root/src/di/types";
import { type Downloader } from "@root/src/domain/adapters/Downloader";
import { inject } from "inversify";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { type DeviceConnectionConfig } from "@root/src/domain/repositories/DeviceRepository";
import { type DockerContainer } from "@root/src/domain/adapters/DockerContainer";

const DEFAULT_MODEL_MAPPING: Record<
    string,
    { os: string; version: string; containerName?: string }
> = {
    stax: {
        os: "1.8.1",
        version: "1.19.1",
    },
    nanox: {
        os: "2.5.1",
        version: "1.19.1",
    },
    nanos: {
        os: "2.1.0",
        version: "1.15.0",
    },
    "nanos+": {
        os: "1.4.1",
        version: "1.19.1",
        containerName: "cs-tester-speculos-nanosplus",
    },
    flex: {
        os: "1.4.1",
        version: "1.19.1",
    },
    apex: {
        os: "1.0.1",
        version: "1.19.1",
    },
};

const SPECULOS_DOCKER_IMAGE_LATEST = "ghcr.io/ledgerhq/speculos:latest";
const TEMP_APP_PATH = "/tmp/sc-tester/apps";
const SPECULOS_API_PORT = 5000;

export class SpeculosController implements Controller {
    private readonly logger: LoggerPublisherService;
    private readonly model: DeviceConnectionConfig["device"];
    private readonly os: string;
    private readonly version: string;
    private readonly containerName: string;

    constructor(
        @inject(TYPES.Downloader)
        private readonly downloader: Downloader,
        @inject(TYPES.DockerContainer)
        private readonly dockerContainer: DockerContainer,
        @inject(TYPES.DeviceConnectionConfig)
        private readonly deviceConnectionConfig: DeviceConnectionConfig,
        @inject(TYPES.LoggerPublisherServiceFactory)
        private readonly loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = this.loggerFactory("speculos-controller");
        this.model = this.deviceConnectionConfig.device;
        this.os =
            this.deviceConnectionConfig.os ||
            DEFAULT_MODEL_MAPPING[this.model]?.os ||
            "";
        this.version =
            this.deviceConnectionConfig.version ||
            DEFAULT_MODEL_MAPPING[this.model]?.version ||
            "";
        this.containerName =
            DEFAULT_MODEL_MAPPING[this.model]?.containerName ||
            `cs-tester-speculos-${this.model}`;
    }

    async start(): Promise<void> {
        await this.downloadApp(this.model, this.os, this.version);

        // const randomPort = Math.floor(Math.random() * 10000) + 10000;
        const randomPort = 5000; // TODO: add back random port
        const appName = this.getAppName(this.model, this.os, this.version);

        this.logger.info(
            `Starting Docker container with name: ${this.containerName}`,
        );

        await this.dockerContainer.start(SPECULOS_DOCKER_IMAGE_LATEST, {
            command: [
                `apps/${appName}`,
                "--display",
                "headless",
                "--api-port",
                SPECULOS_API_PORT.toString(),
                "-p", // Use prod signatures
            ],
            volumes: [`${TEMP_APP_PATH}:/speculos/apps`],
            ports: [`${randomPort}:${SPECULOS_API_PORT}`],
            additionalArgs: ["--name", this.containerName],
            detached: true,
            removeOnStop: true,
        });

        // wait for the container to start
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    async stop(): Promise<void> {
        await this.dockerContainer.stop();
    }

    private async downloadApp(
        model: string,
        os: string,
        version: string,
    ): Promise<void> {
        const appPath = this.getAppPath(model, os, version);
        if (await this.downloader.isDownloaded(appPath)) {
            this.logger.debug(`App already downloaded at ${appPath}`);
            return;
        }

        await this.downloader.download(
            `https://raw.githubusercontent.com/LedgerHQ/coin-apps/master/${model}/${os}/Ethereum/app_${version}.elf`,
            appPath,
        );
    }

    private getAppName(model: string, os: string, version: string): string {
        return `${version}-${model}-${os}.elf`;
    }

    private getAppPath(model: string, os: string, version: string): string {
        return `${TEMP_APP_PATH}/${this.getAppName(model, os, version)}`;
    }
}

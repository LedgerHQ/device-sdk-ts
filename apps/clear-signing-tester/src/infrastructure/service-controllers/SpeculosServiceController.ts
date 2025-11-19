import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DockerContainer } from "@root/src/domain/adapters/DockerContainer";
import { type AppsConfig } from "@root/src/domain/models/config/AppsConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

const DEFAULT_MODEL_MAPPING: Record<
  SpeculosConfig["device"],
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
const SPECULOS_API_PORT = 5000;

export class SpeculosServiceController implements ServiceController {
  private readonly logger: LoggerPublisherService;
  private readonly model: SpeculosConfig["device"];
  private readonly os: string;
  private readonly version: string;
  private readonly containerName: string;

  constructor(
    @inject(TYPES.DockerContainer)
    private readonly dockerContainer: DockerContainer,
    @inject(TYPES.SpeculosConfig)
    private readonly config: SpeculosConfig,
    @inject(TYPES.AppsConfig)
    private readonly appsConfig: AppsConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    const { device, os, version } = this.config;
    this.logger = this.loggerFactory("speculos-service-controller");
    this.model = device;
    this.os = os || DEFAULT_MODEL_MAPPING[device].os;
    this.version = version || DEFAULT_MODEL_MAPPING[device].version;
    this.containerName =
      DEFAULT_MODEL_MAPPING[device]?.containerName ||
      `cs-tester-speculos-${device}-${this.config.port}`;
  }

  async start(): Promise<void> {
    const appPath = this.getAppPath(this.model, this.os, this.version);

    this.logger.info(
      `Starting Docker container with name: ${this.containerName}`,
    );
    this.logger.info(`API url: ${this.config.url}:${this.config.port}`);
    this.logger.info(`Using app: ${appPath}`);

    await this.dockerContainer.start(SPECULOS_DOCKER_IMAGE_LATEST, {
      command: [
        `/apps/${this.model}/${this.os}/Ethereum/app_${this.version}.elf`,
        "--display",
        "headless",
        "--api-port",
        SPECULOS_API_PORT.toString(),
        "-p", // Use prod signatures
      ],
      volumes: [`${this.appsConfig.path}:/apps`],
      ports: [`${this.config.port}:${SPECULOS_API_PORT}`],
      detached: true,
      removeOnStop: true,
      name: this.containerName,
    });

    // Wait for the container to fully initialize before proceeding
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async stop(): Promise<void> {
    await this.dockerContainer.stop();
  }

  private getAppPath(model: string, os: string, version: string): string {
    return `${this.appsConfig.path}/${model}/${os}/Ethereum/app_${version}.elf`;
  }
}

import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DockerContainer } from "@root/src/domain/adapters/DockerContainer";
import { type AppsConfig } from "@root/src/domain/models/config/AppsConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type AppVersionResolver } from "@root/src/domain/services/AppVersionResolver";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

const DEFAULT_CONTAINER_NAMES: Partial<
  Record<SpeculosConfig["device"], string>
> = {
  "nanos+": "cs-tester-speculos-nanosplus",
};

const SPECULOS_DOCKER_IMAGE_LATEST =
  "ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools";
const SPECULOS_API_PORT = 5000;

@injectable()
export class SpeculosServiceController implements ServiceController {
  private readonly logger: LoggerPublisherService;
  private readonly model: SpeculosConfig["device"];
  private os?: string;
  private version?: string;
  private readonly plugin?: string;
  private pluginVersion?: string;
  private readonly containerName: string;

  constructor(
    @inject(TYPES.DockerContainer)
    private readonly dockerContainer: DockerContainer,
    @inject(TYPES.SpeculosConfig)
    private readonly config: SpeculosConfig,
    @inject(TYPES.AppsConfig)
    private readonly appsConfig: AppsConfig,
    @inject(TYPES.AppVersionResolver)
    private readonly appVersionResolver: AppVersionResolver,
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = this.loggerFactory("speculos-service-controller");
    this.model = this.config.device;
    this.os = this.config.os;
    this.version = this.config.version;
    this.plugin = this.config.plugin;
    this.pluginVersion = this.config.pluginVersion;
    this.containerName =
      DEFAULT_CONTAINER_NAMES[this.model] ||
      `cs-tester-speculos-${this.model}-${this.config.port}`;
  }

  async start(): Promise<void> {
    // Resolve the Ethereum app version and OS using the resolver
    const resolvedEthereum = this.appVersionResolver.resolve(
      this.model,
      "Ethereum",
      this.os,
      this.version,
    );

    // Update with resolved values
    this.os = resolvedEthereum.os;
    this.version = resolvedEthereum.version;

    let command: string[];

    if (this.plugin) {
      // Resolve the plugin app version
      const resolvedPlugin = this.appVersionResolver.resolve(
        this.model,
        this.plugin,
        this.os,
        this.pluginVersion,
      );

      // Update plugin version with resolved value
      this.pluginVersion = resolvedPlugin.version;

      // Build command with plugin and -l flag for Ethereum app
      const pluginPath = `/apps/${this.model}/${this.os}/${this.plugin}/app_${this.pluginVersion}.elf`;
      const ethereumPath = `/apps/${this.model}/${this.os}/Ethereum/app_${this.version}.elf`;

      this.logger.info(
        `Starting Docker container with name: ${this.containerName}`,
      );
      this.logger.info(`API url: ${this.config.url}:${this.config.port}`);
      this.logger.info(`Using plugin: ${resolvedPlugin.path}`);
      this.logger.info(`Loading Ethereum app: ${resolvedEthereum.path}`);
      this.logger.info(
        `Resolved versions: device=${this.model}, os=${this.os}, plugin=${this.plugin}@${this.pluginVersion}, ethereum=${this.version}`,
      );

      command = [
        "speculos",
        ethereumPath,
        "-l",
        pluginPath,
        "--display",
        "headless",
        "--api-port",
        SPECULOS_API_PORT.toString(),
        "--user",
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        "-p", // Use prod signatures
      ];
    } else {
      // No plugin, just run Ethereum app
      this.logger.info(
        `Starting Docker container with name: ${this.containerName}`,
      );
      this.logger.info(`API url: ${this.config.url}:${this.config.port}`);
      this.logger.info(`Using app: ${resolvedEthereum.path}`);
      this.logger.info(
        `Resolved versions: device=${this.model}, os=${this.os}, ethereum=${this.version}`,
      );

      command = [
        "speculos",
        `/apps/${this.model}/${this.os}/Ethereum/app_${this.version}.elf`,
        "--display",
        "headless",
        "--api-port",
        SPECULOS_API_PORT.toString(),
        "--user",
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        "-p", // Use prod signatures
      ];
    }

    await this.dockerContainer.start(SPECULOS_DOCKER_IMAGE_LATEST, {
      command,
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
}

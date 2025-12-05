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
  "ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools:latest";
const SPECULOS_API_PORT = 5000;

@injectable()
export class SpeculosServiceController implements ServiceController {
  private readonly logger: LoggerPublisherService;
  private readonly model: SpeculosConfig["device"];
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
    this.containerName =
      DEFAULT_CONTAINER_NAMES[this.model] ||
      `cs-tester-speculos-${this.model}-${this.config.port}`;
  }

  async start(): Promise<void> {
    // Resolve the Ethereum app version and OS using the resolver
    const resolvedEthereum = this.appVersionResolver.resolve(
      this.model,
      "Ethereum",
      this.config.os,
      this.config.version,
    );

    const ethereumPath = `/apps/${this.model}/${resolvedEthereum.os}/Ethereum/app_${resolvedEthereum.version}.elf`;

    // Optionally resolve plugin
    const resolvedPlugin = this.config.plugin
      ? this.appVersionResolver.resolve(
          this.model,
          this.config.plugin,
          resolvedEthereum.os,
          this.config.pluginVersion,
        )
      : null;

    const pluginArgs = resolvedPlugin
      ? [
          "-l",
          `/apps/${this.model}/${resolvedEthereum.os}/${this.config.plugin}/app_${resolvedPlugin.version}.elf`,
        ]
      : [];

    // Logging
    this.logger.info(
      `Starting Docker container with name: ${this.containerName}`,
    );
    this.logger.info(`API url: ${this.config.url}:${this.config.port}`);
    this.logger.debug(`Using app: ${resolvedEthereum.path}`);
    if (resolvedPlugin) {
      this.logger.debug(`Using plugin: ${resolvedPlugin.path}`);
    }
    this.logger.info(`device=${this.model}`);
    this.logger.info(`os=${resolvedEthereum.os}`);
    this.logger.info(`ethereum=${resolvedEthereum.version}`);
    if (resolvedPlugin) {
      this.logger.info(
        `plugin=${this.config.plugin}@${resolvedPlugin.version}`,
      );
    }

    const command = [
      "speculos",
      ethereumPath,
      ...pluginArgs,
      "--display",
      "headless",
      "--api-port",
      SPECULOS_API_PORT.toString(),
      "--user",
      `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "-p", // Use prod signatures
    ];

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

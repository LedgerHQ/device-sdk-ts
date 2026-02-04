import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DockerContainer } from "@root/src/domain/adapters/DockerContainer";
import { type AppsConfig } from "@root/src/domain/models/config/AppsConfig";
import { type CalConfig } from "@root/src/domain/models/config/CalConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type AppVersionResolver } from "@root/src/domain/services/AppVersionResolver";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

const DEFAULT_CONTAINER_NAMES: Partial<
  Record<SpeculosConfig["device"], string>
> = {
  "nanos+": "cs-tester-speculos-nanosplus",
};

const SPECULOS_DOCKER_IMAGE_BASE =
  "ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools";
const SPECULOS_API_PORT = 5000;
const SPECULOS_VNC_PORT = 5900;

/**
 * Validates that a relative path does not contain path traversal sequences.
 * @throws Error if the path contains path traversal sequences
 */
function validateRelativePath(relativePath: string): void {
  // Check for path traversal patterns
  const pathSegments = relativePath.split("/");
  for (const segment of pathSegments) {
    if (segment === ".." || segment === ".") {
      throw new Error(
        `Invalid custom app path: path traversal sequences ("${segment}") are not allowed in relative paths`,
      );
    }
  }
}

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
    @inject(TYPES.CalConfig)
    private readonly calConfig: CalConfig,
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
    let appPath: string;
    let pluginArgs: string[] = [];
    let customAppVolume: string | null = null;

    if (this.config.customAppPath) {
      // Use custom app path directly
      if (this.config.customAppPath.startsWith("/")) {
        // Absolute path on host: mount the file directly to /custom-app/app.elf
        customAppVolume = `${this.config.customAppPath}:/custom-app/app.elf`;
        appPath = "/custom-app/app.elf";
      } else {
        // Relative path: validate against path traversal and use /apps mount (COIN_APPS_PATH)
        validateRelativePath(this.config.customAppPath);
        appPath = `/apps/${this.config.customAppPath}`;
      }

      this.logger.info(
        `Starting Docker container with name: ${this.containerName}`,
      );
      this.logger.info(`API url: ${this.config.url}:${this.config.port}`);
      this.logger.info(
        `VNC url: ${this.config.url.replace("http://", "vnc://")}:${this.config.vncPort}`,
      );
      this.logger.info(`device=${this.model}`);
      this.logger.info(`Using custom app: ${appPath}`);
      if (customAppVolume) {
        this.logger.info(`Custom app volume: ${customAppVolume}`);
      }
    } else {
      // Resolve the Ethereum app version and OS using the resolver
      const resolvedEthereum = this.appVersionResolver.resolve(
        this.model,
        "Ethereum",
        this.config.os,
        this.config.version,
      );

      appPath = `/apps/${this.model}/${resolvedEthereum.os}/Ethereum/app_${resolvedEthereum.version}.elf`;

      // Optionally resolve plugin
      const resolvedPlugin = this.config.plugin
        ? this.appVersionResolver.resolve(
            this.model,
            this.config.plugin,
            resolvedEthereum.os,
            this.config.pluginVersion,
          )
        : null;

      pluginArgs = resolvedPlugin
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
      this.logger.info(
        `VNC url: ${this.config.url.replace("http://", "vnc://")}:${this.config.vncPort}`,
      );
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
    }

    // Build command arguments
    const command = [
      "speculos",
      appPath,
      ...pluginArgs,
      "--display",
      "headless",
      "--api-port",
      SPECULOS_API_PORT.toString(),
      "--vnc-port",
      SPECULOS_VNC_PORT.toString(),
      "--user",
      `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    ];

    // Add "-p" flag for prod signatures only when CAL mode is "prod"
    if (this.calConfig.mode === "prod") {
      command.push("-p");
    }

    const dockerImage = `${SPECULOS_DOCKER_IMAGE_BASE}:${this.config.dockerImageTag}`;

    if ((await this.dockerContainer.getImageId(dockerImage)) === null) {
      await this.dockerContainer.pull(dockerImage);
    }

    // Build volumes array
    const volumes = [`${this.appsConfig.path}:/apps`];
    if (customAppVolume) {
      volumes.push(customAppVolume);
    }

    await this.dockerContainer.start(dockerImage, {
      command,
      volumes,
      ports: [
        `${this.config.port}:${SPECULOS_API_PORT}`,
        `${this.config.vncPort}:${SPECULOS_VNC_PORT}`,
      ],
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

import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { spawn } from "child_process";
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
    await this.warnIfLatestImageIsStale(dockerImage);

    if (
      this.config.forcePull ||
      (await this.dockerContainer.getImageId(dockerImage)) === null
    ) {
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
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  async stop(): Promise<void> {
    await this.dockerContainer.stop();
  }

  private async warnIfLatestImageIsStale(dockerImage: string): Promise<void> {
    if (this.config.dockerImageTag !== "latest") {
      return;
    }

    const [localDigest, remoteDigest, localVersion, remoteVersion] =
      await Promise.all([
        this.getLocalManifestDigest(dockerImage),
        this.getRemoteManifestDigest(dockerImage),
        this.getLocalImageVersion(dockerImage),
        this.getRemoteImageVersion(dockerImage),
      ]);

    if (!localDigest || !remoteDigest || localDigest === remoteDigest) {
      return;
    }

    const localVersionLabel = localVersion ?? "unknown";
    const remoteVersionLabel = remoteVersion ?? "unknown";

    this.logger.warn(
      `Docker image "${dockerImage}" is stale locally (localDigest=${localDigest}, remoteDigest=${remoteDigest}, localVersion=${localVersionLabel}, remoteVersion=${remoteVersionLabel}). Run "docker pull ${dockerImage}" to update.`,
    );
  }

  private async getLocalManifestDigest(
    dockerImage: string,
  ): Promise<string | null> {
    try {
      const output = await this.runCommand("docker", [
        "image",
        "inspect",
        "--format",
        "{{index .RepoDigests 0}}",
        dockerImage,
      ]);
      const repoDigest = output.trim();
      const digest = repoDigest.split("@")[1]?.trim();
      return digest ?? null;
    } catch {
      return null;
    }
  }

  private async getRemoteManifestDigest(
    dockerImage: string,
  ): Promise<string | null> {
    try {
      const output = await this.runCommand("docker", [
        "buildx",
        "imagetools",
        "inspect",
        dockerImage,
        "--format",
        "{{json .Manifest.Digest}}",
      ]);
      const rawDigest = output.trim();
      // Output is JSON encoded, e.g. "sha256:..."
      const digest = JSON.parse(rawDigest) as string;
      return digest || null;
    } catch (error) {
      this.logger.debug(
        `Unable to resolve remote digest for "${dockerImage}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async getLocalImageVersion(
    dockerImage: string,
  ): Promise<string | null> {
    try {
      const output = await this.runCommand("docker", [
        "image",
        "inspect",
        "--format",
        '{{index .Config.Labels "org.opencontainers.image.version"}}',
        dockerImage,
      ]);
      const version = output.trim();
      return version.length > 0 ? version : null;
    } catch {
      return null;
    }
  }

  private async getRemoteImageVersion(
    dockerImage: string,
  ): Promise<string | null> {
    try {
      const output = await this.runCommand("docker", [
        "buildx",
        "imagetools",
        "inspect",
        dockerImage,
        "--format",
        "{{json .Image}}",
      ]);
      const imageData = JSON.parse(output) as Record<
        string,
        { config?: { Labels?: Record<string, string> } }
      >;

      const preferredPlatform = this.getDockerPlatformKey();
      const platformData =
        imageData[preferredPlatform] ??
        imageData["linux/amd64"] ??
        imageData["linux/arm64"] ??
        Object.values(imageData)[0];

      return (
        platformData?.config?.Labels?.["org.opencontainers.image.version"] ??
        null
      );
    } catch (error) {
      this.logger.debug(
        `Unable to resolve remote image version for "${dockerImage}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private getDockerPlatformKey(): string {
    // Docker platform keys for these images always use "linux" as the OS
    // component, regardless of the host OS. We normalize the architecture
    // to match Docker naming (e.g. "amd64" instead of Node's "x64").
    const dockerOs = "linux";
    const arch = process.arch === "x64" ? "amd64" : process.arch;
    return `${dockerOs}/${arch}`;
  }

  private runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(
              `Command failed (${command} ${args.join(" ")}): ${stderr.trim()}`,
            ),
          );
        }
      });

      childProcess.on("error", (error) => {
        reject(error);
      });
    });
  }
}

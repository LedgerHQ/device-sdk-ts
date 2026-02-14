import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { spawn } from "child_process";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import {
  DockerContainer,
  DockerRunOptions,
} from "@root/src/domain/adapters/DockerContainer";

@injectable()
export class NodeDockerContainer implements DockerContainer {
  private readonly logger: LoggerPublisherService;
  private currentContainerName: string | null = null;

  constructor(
    @inject(TYPES.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = this.loggerFactory("node-docker-container");
  }

  async start(imageName: string, options: DockerRunOptions): Promise<string> {
    this.logger.debug(`Starting Docker container with image: ${imageName}`);

    // Stop existing container if running
    if (this.currentContainerName) {
      await this.stop();
    }

    this.currentContainerName = options.name;
    const dockerArgs = this.buildDockerRunArgs(imageName, options);

    return new Promise((resolve, reject) => {
      this.logger.debug(
        `Spawning docker process with: docker ${dockerArgs.join(" ")}`,
      );
      const dockerProcess = spawn("docker", dockerArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Pipe stdout for debugging
      dockerProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        this.logger.debug(`[stdout] ${output}`);
      });

      // Pipe stderr for debugging
      dockerProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        this.logger.debug(`[error] ${output}`);
      });

      dockerProcess.on("error", (error) => {
        this.logger.error(`Docker process error: ${error.message}`);
        reject(new Error(`Failed to spawn docker process: ${error.message}`));
      });

      this.logger.debug(`Docker container started with name: ${options.name}`);
      resolve(options.name);
    });
  }

  async stop(): Promise<void> {
    if (!this.currentContainerName) {
      this.logger.debug("No container to stop");
      return;
    }

    this.logger.debug(
      `Stopping Docker container: ${this.currentContainerName}`,
    );

    return new Promise((resolve, reject) => {
      const dockerProcess = spawn(
        "docker",
        ["stop", this.currentContainerName!],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let errorOutput = "";

      dockerProcess.stderr?.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      dockerProcess.on("close", (code) => {
        if (code === 0) {
          this.logger.debug(
            `Docker container stopped: ${this.currentContainerName}`,
          );
          this.currentContainerName = null;
          resolve();
        } else {
          const error = new Error(
            `Docker stop failed with exit code ${code}: ${errorOutput}`,
          );
          this.logger.error(
            `Failed to stop Docker container: ${error.message}`,
          );
          reject(error);
        }
      });

      dockerProcess.on("error", (error) => {
        this.logger.error(`Docker stop process error: ${error.message}`);
        reject(
          new Error(`Failed to spawn docker stop process: ${error.message}`),
        );
      });
    });
  }

  async isRunning(): Promise<boolean> {
    if (!this.currentContainerName) {
      return false;
    }

    this.logger.debug(
      `Checking if Docker container is running: ${this.currentContainerName}`,
    );

    return new Promise((resolve, reject) => {
      const dockerProcess = spawn(
        "docker",
        [
          "ps",
          "--filter",
          `name=${this.currentContainerName}`,
          "--format",
          "{{.Names}}",
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let output = "";
      let errorOutput = "";

      // The 'data' parameter is of type Buffer
      dockerProcess.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });

      dockerProcess.stderr?.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      dockerProcess.on("close", (code) => {
        if (code === 0) {
          const isRunning = output.trim() === this.currentContainerName;
          this.logger.debug(
            `Container ${this.currentContainerName} running status: ${isRunning}`,
          );

          // Update internal state if container is not running
          if (!isRunning) {
            this.currentContainerName = null;
          }

          resolve(isRunning);
        } else {
          const error = new Error(
            `Docker ps failed with exit code ${code}: ${errorOutput}`,
          );
          this.logger.error(
            `Failed to check Docker container status: ${error.message}`,
          );
          reject(error);
        }
      });

      dockerProcess.on("error", (error) => {
        this.logger.error(`Docker ps process error: ${error.message}`);
        reject(
          new Error(`Failed to spawn docker ps process: ${error.message}`),
        );
      });
    });
  }

  async pull(imageName: string): Promise<void> {
    this.logger.info(`Pulling Docker image: ${imageName}`);
    this.logger.info("This might take a while...");
    return new Promise((resolve, reject) => {
      const dockerProcess = spawn("docker", ["pull", imageName], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      dockerProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        this.logger.debug(`[stdout] ${output}`);
      });

      dockerProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        this.logger.debug(`[error] ${output}`);
      });

      dockerProcess.on("close", (code) => {
        if (code === 0) {
          this.logger.info(`Docker image pulled: ${imageName}`);
          resolve();
        } else {
          reject(new Error(`Failed to pull Docker image: ${imageName}`));
        }
      });

      dockerProcess.on("error", (error) => {
        this.logger.error(`Docker pull process error: ${error.message}`);
        reject(
          new Error(`Failed to spawn docker pull process: ${error.message}`),
        );
      });
    });
  }

  getContainerId(): string | null {
    return this.currentContainerName;
  }

  getImageId(image: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const dockerProcess = spawn(
        "docker",
        ["image", "ls", "--format", "{{.ID}}", image],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let output = "";
      let errorOutput = "";

      dockerProcess.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      dockerProcess.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      dockerProcess.on("close", (code) => {
        if (code !== 0) {
          return reject(
            new Error(`Failed to list Docker image: ${errorOutput}`),
          );
        }

        const id = output.trim();

        // If no image found, output will be empty
        resolve(id.length > 0 ? id : null);
      });

      dockerProcess.on("error", (error) => {
        reject(new Error(`Docker image ls process error: ${error.message}`));
      });
    });
  }

  private buildDockerRunArgs(
    imageName: string,
    options: DockerRunOptions,
  ): string[] {
    const args = ["run"];

    // Add detached mode
    if (options.detached) {
      args.push("-d");
    }

    // Add container name
    args.push("--name", options.name);

    // Add remove on stop option
    if (options.removeOnStop) {
      args.push("--rm");
    }

    // Add port mappings
    if (options.ports) {
      options.ports.forEach((port) => {
        args.push("-p", port);
      });
    }

    // Add volume mappings
    if (options.volumes) {
      options.volumes.forEach((volume) => {
        args.push("-v", volume);
      });
    }

    // Add environment variables
    if (options.env) {
      options.env.forEach((envVar) => {
        args.push("-e", envVar);
      });
    }

    // Add additional arguments
    if (options.additionalArgs) {
      args.push(...options.additionalArgs);
    }

    // Add image name
    args.push(imageName);

    args.push(...options.command);

    return args;
  }
}

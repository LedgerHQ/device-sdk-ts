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
    private currentContainerId: string | null = null;

    constructor(
        @inject(TYPES.LoggerPublisherServiceFactory)
        private readonly loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = this.loggerFactory("node-docker-container");
    }

    async start(imageName: string, options: DockerRunOptions): Promise<string> {
        this.logger.debug(`Starting Docker container with image: ${imageName}`);

        // Stop existing container if running
        if (this.currentContainerId) {
            await this.stop();
        }

        const dockerArgs = this.buildDockerRunArgs(imageName, options);

        return new Promise((resolve, reject) => {
            this.logger.debug(
                `Spawning docker process with: docker ${dockerArgs.join(" ")}`,
            );
            const dockerProcess = spawn("docker", dockerArgs, {
                stdio: ["ignore", "pipe", "pipe"],
            });

            let containerId = "";
            let errorOutput = "";

            dockerProcess.stdout?.on("data", (data: Buffer) => {
                const output = data.toString().trim();
                if (output) {
                    containerId = output;
                    this.logger.debug(
                        `Docker container started with ID: ${containerId}`,
                    );
                }
            });

            dockerProcess.stderr?.on("data", (data: Buffer) => {
                errorOutput += data.toString();
            });

            dockerProcess.on("close", (code) => {
                if (code === 0 && containerId) {
                    this.currentContainerId = containerId;
                    resolve(containerId);
                } else {
                    const error = new Error(
                        `Docker run failed with exit code ${code}: ${errorOutput}`,
                    );
                    this.logger.error(
                        `Failed to start Docker container: ${error.message}`,
                    );
                    reject(error);
                }
            });

            dockerProcess.on("error", (error) => {
                this.logger.error(`Docker process error: ${error.message}`);
                reject(
                    new Error(
                        `Failed to spawn docker process: ${error.message}`,
                    ),
                );
            });
        });
    }

    async stop(): Promise<void> {
        if (!this.currentContainerId) {
            this.logger.debug("No container to stop");
            return;
        }

        this.logger.debug(
            `Stopping Docker container: ${this.currentContainerId}`,
        );

        return new Promise((resolve, reject) => {
            const dockerProcess = spawn(
                "docker",
                ["stop", this.currentContainerId!],
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
                        `Docker container stopped: ${this.currentContainerId}`,
                    );
                    this.currentContainerId = null;
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
                this.logger.error(
                    `Docker stop process error: ${error.message}`,
                );
                reject(
                    new Error(
                        `Failed to spawn docker stop process: ${error.message}`,
                    ),
                );
            });
        });
    }

    async isRunning(): Promise<boolean> {
        if (!this.currentContainerId) {
            return false;
        }

        this.logger.debug(
            `Checking if Docker container is running: ${this.currentContainerId}`,
        );

        return new Promise((resolve, reject) => {
            const dockerProcess = spawn(
                "docker",
                [
                    "ps",
                    "--filter",
                    `id=${this.currentContainerId}`,
                    "--format",
                    "{{.ID}}",
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
                    const isRunning = output.trim() === this.currentContainerId;
                    this.logger.debug(
                        `Container ${this.currentContainerId} running status: ${isRunning}`,
                    );

                    // Update internal state if container is not running
                    if (!isRunning) {
                        this.currentContainerId = null;
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
                    new Error(
                        `Failed to spawn docker ps process: ${error.message}`,
                    ),
                );
            });
        });
    }

    getContainerId(): string | null {
        return this.currentContainerId;
    }

    private buildDockerRunArgs(
        imageName: string,
        options: DockerRunOptions,
    ): string[] {
        const args = ["run"];

        // Add detached mode (default to true)
        if (options.detached !== false) {
            args.push("-d");
        }

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

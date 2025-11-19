export interface DockerContainer {
  /**
   * Start a Docker container using the specified image and options
   * @param imageName - The Docker image name to run
   * @param options - Additional docker run options (ports, volumes, etc.)
   * @returns Promise resolving to the container ID
   */
  start(imageName: string, options?: DockerRunOptions): Promise<string>;

  /**
   * Stop the currently running Docker container
   * @returns Promise resolving when container is stopped
   */
  stop(): Promise<void>;

  /**
   * Check if the Docker container is running
   * @returns Promise resolving to true if container is running
   */
  isRunning(): Promise<boolean>;

  /**
   * Get the current container ID
   * @returns The container ID if running, null otherwise
   */
  getContainerId(): string | null;
}

export type DockerRunOptions = {
  /** Container name */
  name: string;
  /** Command to run in the container */
  command: string[];
  /** Port mappings in format "hostPort:containerPort" */
  ports?: string[];
  /** Volume mappings in format "hostPath:containerPath" */
  volumes?: string[];
  /** Environment variables in format "KEY=value" */
  env?: string[];
  /** Run container in detached mode */
  detached?: boolean;
  /** Remove container when it stops */
  removeOnStop?: boolean;
  /** Additional docker run arguments */
  additionalArgs?: string[];
};

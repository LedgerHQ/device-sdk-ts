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
   * Pull a Docker image
   * @param imageName - The Docker image name to pull
   * @returns Promise resolving when image is pulled
   */
  pull(imageName: string): Promise<void>;

  /**
   * Get the current container ID
   * @returns The container ID if running, null otherwise
   */
  getContainerId(): string | null;

  /**
   * Get the ID of a Docker image
   * @param image - The Docker image name and tag
   * @returns Promise resolving to the image ID if found, null otherwise
   */
  getImageId(image: string): Promise<string | null>;

  /**
   * Get the repo digest of a locally cached Docker image.
   * @param image - The Docker image name and tag
   * @returns Promise resolving to the digest string (e.g. "sha256:..."), or null
   */
  getLocalImageRepoDigest(image: string): Promise<string | null>;

  /**
   * Get the manifest digest of a Docker image from the remote registry.
   * @param image - The Docker image name and tag
   * @returns Promise resolving to the digest string (e.g. "sha256:..."), or null
   */
  getRemoteImageManifestDigest(image: string): Promise<string | null>;

  /**
   * Get a metadata label value from a locally cached Docker image.
   * @param image - The Docker image name and tag
   * @param label - The label key (e.g. "org.opencontainers.image.version")
   * @returns Promise resolving to the label value, or null
   */
  getLocalImageLabel(image: string, label: string): Promise<string | null>;

  /**
   * Get a metadata label value from a Docker image in the remote registry,
   * selecting the platform matching the current host architecture.
   * @param image - The Docker image name and tag
   * @param label - The label key (e.g. "org.opencontainers.image.version")
   * @returns Promise resolving to the label value, or null
   */
  getRemoteImageLabel(image: string, label: string): Promise<string | null>;
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

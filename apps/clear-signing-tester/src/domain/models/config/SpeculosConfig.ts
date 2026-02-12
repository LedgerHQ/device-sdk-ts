/**
 * Domain model representing the configuration for the Speculos service
 */
export type SpeculosConfig = {
  url: string;
  port: number;
  vncPort: number;
  device: "stax" | "nanox" | "nanos" | "nanos+" | "flex" | "apex";
  dockerImageTag: string;
  os?: string;
  version?: string;
  plugin?: string;
  pluginVersion?: string;
  screenshotPath?: string;
  /**
   * Custom app file path. When provided, bypasses automatic Ethereum app version resolution.
   * - Relative paths (e.g., "stax/1.8.1/Ethereum/app_1.19.1.elf") are resolved relative to COIN_APPS_PATH
   * - Absolute paths (e.g., "/home/user/builds/my_app.elf") are mounted into the container automatically
   */
  customAppPath?: string;
};

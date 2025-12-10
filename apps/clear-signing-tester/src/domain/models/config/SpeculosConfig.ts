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
};

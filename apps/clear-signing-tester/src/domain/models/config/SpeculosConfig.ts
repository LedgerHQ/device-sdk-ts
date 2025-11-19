/**
 * Domain model representing the configuration for the Speculos service
 */
export type SpeculosConfig = {
  url: string;
  port: number;
  device: "stax" | "nanox" | "nanos" | "nanos+" | "flex" | "apex";
  os?: string;
  version?: string;
};

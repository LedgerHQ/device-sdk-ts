export type SpeculinhoConfig = {
  device: "stax" | "nanox" | "nanos" | "nanos+" | "flex" | "apex";
  appName?: string;
  appVersion?: string;
  osVersion?: string;
  screenshotPath?: string;
  speculinhoUrl?: string;
  resolvedUrl?: string;
  speculosHttpTimeoutMs?: number;
};

/**
 * Configuration for CAL (Crypto Assets List) service
 */
export type CalConfig = {
  url: string;
  mode: "prod" | "test";
  branch: "main" | "next" | "demo";
};

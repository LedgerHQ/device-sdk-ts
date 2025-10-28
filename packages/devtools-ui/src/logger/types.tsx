export type DevToolsLog = {
  /** ISO 8601 timestamp */
  timestamp: string;
  tag: string;
  verbosity: "debug" | "info" | "warning" | "error" | "fatal";
  message: string;
  payloadJSON: string; // extra data, can be an empty string
};

export type LogData = DevToolsLog & {
  payload: string | Record<string, unknown>;
};

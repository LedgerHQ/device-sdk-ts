import type { DevToolsLog, LogData } from "./types";

export function mapConnectorMessageToLogData(payload: string): LogData | null {
  const { timestamp, tag, verbosity, message, payloadJSON } = JSON.parse(
    payload,
  ) as DevToolsLog;
  return {
    timestamp,
    tag,
    verbosity,
    message,
    payloadJSON,
    // TODO: fix this type
    payload: JSON.parse(payloadJSON) as string | Record<string, unknown>,
  };
}

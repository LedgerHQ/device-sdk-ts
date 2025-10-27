import { DevToolsLog, LogData } from "./types";

export function mapConnectorMessageToLogData(connectorMessage: {
  type: string;
  payload: string;
}): LogData | null {
  if (connectorMessage.type !== "addLog") {
    return null;
  }
  const { timestamp, tag, verbosity, message, payloadJSON } = JSON.parse(
    connectorMessage.payload
  ) as DevToolsLog;
  return {
    timestamp,
    tag,
    verbosity,
    message,
    payloadJSON,
    payload: JSON.parse(payloadJSON),
  };
}

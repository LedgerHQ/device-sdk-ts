import { LOGGER_MESSAGE_TYPES } from "@ledgerhq/device-management-kit-devtools-core";

import type { DevToolsLog, LogData } from "./types";

export function mapConnectorMessageToLogData(connectorMessage: {
  type: string;
  payload: string;
}): LogData | null {
  if (connectorMessage.type !== LOGGER_MESSAGE_TYPES.ADD_LOG) {
    return null;
  }
  const { timestamp, tag, verbosity, message, payloadJSON } = JSON.parse(
    connectorMessage.payload,
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

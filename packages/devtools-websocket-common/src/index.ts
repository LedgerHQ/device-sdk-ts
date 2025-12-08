export const DEFAULT_CLIENT_PORT = 10001;
export const DEFAULT_DASHBOARD_PORT = 10002;

export const DEFAULT_CLIENT_WS_URL = `ws://localhost:${DEFAULT_CLIENT_PORT}`;
export const DEFAULT_DASHBOARD_WS_URL = `ws://localhost:${DEFAULT_DASHBOARD_PORT}`;

export const WEBSOCKET_MESSAGE_TYPES = {
  INIT: "init",
  MESSAGE: "message",
} as const;

export function formatSocketMessage(msg: {
  type: string;
  payload: string;
}): string {
  return `${msg.type}|${msg.payload}`;
}

export function parseSocketMessage(message: string): {
  type: string;
  payload: string;
} {
  const separatorIndex = message.indexOf("|");
  if (separatorIndex === -1) {
    throw new Error("Invalid message format");
  }
  const type = message.substring(0, separatorIndex);
  const payload = message.substring(separatorIndex + 1);
  return { type, payload };
}

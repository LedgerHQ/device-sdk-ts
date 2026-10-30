import { type LogData } from "../logger/types";

export type ApduExchange = {
  id: string;
  timestamp: string;
  sessionId: string;
  command: string;
  sent: string[];
  received: string[];
  statusWord: string;
};

/** OS commands every app answers; app commands share CLA e0, so they keep their raw CLA INS. */
const COMMAND_NAMES: Record<string, string> = {
  b001: "GET_APP_AND_VERSION",
  b0a7: "CLOSE_APP",
  e001: "GET_OS_VERSION",
  e010: "GET_BATTERY_STATUS",
  e0d8: "OPEN_APP",
  e0de: "LIST_APPS",
  e0df: "LIST_APPS_CONTINUE",
};

const STATUS_NAMES: Record<string, string> = {
  "9000": "OK",
  "5501": "Refused",
  "5502": "PIN not set",
  "5515": "Locked",
  "6807": "App not found",
  "6985": "Refused",
  "6d00": "INS not supported",
  "6e00": "CLA not supported",
};

export const statusName = (statusWord: string) =>
  STATUS_NAMES[statusWord] ?? "";

const toBytes = (hex: string) =>
  hex.toLowerCase().match(/.{1,2}/g) ?? ([] as string[]);

const isApduExchangePayload = (
  payload: LogData["payload"],
): payload is { sessionId: string; apdu: string; response: string } =>
  typeof payload !== "string" &&
  payload["type"] === "apdu-exchange" &&
  typeof payload["sessionId"] === "string" &&
  typeof payload["apdu"] === "string" &&
  typeof payload["response"] === "string";

export const extractApduExchanges = (logs: LogData[]): ApduExchange[] =>
  logs.flatMap((log, index) => {
    if (!isApduExchangePayload(log.payload)) return [];
    const sent = toBytes(log.payload.apdu);
    const received = toBytes(log.payload.response);
    const header = sent.slice(0, 2).join("");
    return [
      {
        id: `${log.timestamp}-${index}`,
        timestamp: log.timestamp,
        sessionId: log.payload.sessionId,
        command: COMMAND_NAMES[header] ?? sent.slice(0, 2).join(" "),
        sent,
        received,
        statusWord: received.slice(-2).join(""),
      },
    ];
  });

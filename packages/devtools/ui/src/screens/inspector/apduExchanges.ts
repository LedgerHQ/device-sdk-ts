import { isDashboardName } from "@ledgerhq/device-management-kit";

import { type LogData } from "../logger/types";
import {
  APP_COMMANDS,
  COMMON_COMMANDS,
  DASHBOARD_COMMANDS,
} from "./apduCommands";

export type ApduExchange = {
  id: string;
  timestamp: string;
  sessionId: string;
  /** Who answered: the OS, the app open at the time, or undefined while that app is unknown. */
  layer: string | undefined;
  command: string;
  sent: string[];
  received: string[];
  statusWord: string;
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

export const OS_LAYER = "OS";

const toAscii = (bytes: string[]) =>
  String.fromCharCode(...bytes.map((byte) => parseInt(byte, 16)));

/** Apps reuse each other's CLA INS, so a command is only named against the app open when it was sent. */
const commandName = (app: string | undefined, key: string) => {
  if (key.startsWith("b0")) return COMMON_COMMANDS[key];
  if (app === undefined) return undefined;
  return isDashboardName(app)
    ? DASHBOARD_COMMANDS[key]
    : APP_COMMANDS[app]?.[key];
};

const layerOf = (app: string | undefined, key: string) =>
  key.startsWith("b0") || (app !== undefined && isDashboardName(app))
    ? OS_LAYER
    : app;

/** The app a successful exchange leaves open, when it tells: GET_APP_AND_VERSION names it, OPEN_APP and CLOSE_APP switch it. */
const appAfter = (
  app: string | undefined,
  key: string,
  sent: string[],
  data: string[],
) => {
  if (key === "b001" && data[0] === "01") {
    return toAscii(data.slice(2, 2 + parseInt(data[1] ?? "0", 16)));
  }
  if (key === "b0a7") return "BOLOS";
  if (key === "e0d8" && (app === undefined || isDashboardName(app))) {
    return toAscii(sent.slice(5));
  }
  return app;
};

const isApduExchangePayload = (
  payload: LogData["payload"],
): payload is { sessionId: string; apdu: string; response: string } =>
  typeof payload !== "string" &&
  payload["type"] === "apdu-exchange" &&
  typeof payload["sessionId"] === "string" &&
  typeof payload["apdu"] === "string" &&
  typeof payload["response"] === "string";

export const extractApduExchanges = (logs: LogData[]): ApduExchange[] => {
  const openApps = new Map<string, string | undefined>();
  return logs.flatMap((log, index) => {
    if (!isApduExchangePayload(log.payload)) return [];
    const { sessionId } = log.payload;
    const sent = toBytes(log.payload.apdu);
    const received = toBytes(log.payload.response);
    const statusWord = received.slice(-2).join("");
    const key = sent.slice(0, 2).join("");
    const app = openApps.get(sessionId);
    if (statusWord === "9000") {
      openApps.set(sessionId, appAfter(app, key, sent, received.slice(0, -2)));
    }
    return [
      {
        id: `${log.timestamp}-${index}`,
        timestamp: log.timestamp,
        sessionId,
        layer: layerOf(app, key),
        command: commandName(app, key) ?? sent.slice(0, 2).join(" "),
        sent,
        received,
        statusWord,
      },
    ];
  });
};

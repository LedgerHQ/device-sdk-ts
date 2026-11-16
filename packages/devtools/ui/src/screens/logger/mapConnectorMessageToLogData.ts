import type { DevToolsLog, LogData } from "./types";

// The log comes from the app: only a string or an object reaches the views, so
// `null`, a number or unreadable JSON cannot break them
const toPayload = (payloadJSON: string): LogData["payload"] => {
  try {
    const payload: unknown = JSON.parse(payloadJSON);
    if (typeof payload === "string") return payload;
    if (payload !== null && typeof payload === "object") {
      return payload as Record<string, unknown>;
    }
    return payload === null ? {} : JSON.stringify(payload);
  } catch {
    return payloadJSON;
  }
};

const VERBOSITIES: ReadonlySet<string> = new Set<LogData["verbosity"]>([
  "debug",
  "info",
  "warning",
  "error",
  "fatal",
]);

const isLog = (value: unknown): value is Partial<DevToolsLog> => {
  if (value === null || typeof value !== "object") return false;
  const { timestamp, tag, verbosity, message, payloadJSON } = value as Record<
    string,
    unknown
  >;
  return (
    typeof timestamp === "string" &&
    typeof tag === "string" &&
    typeof message === "string" &&
    typeof verbosity === "string" &&
    VERBOSITIES.has(verbosity) &&
    (payloadJSON === undefined || typeof payloadJSON === "string")
  );
};

export function mapConnectorMessageToLogData(payload: string): LogData | null {
  let log: unknown;
  try {
    log = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!isLog(log)) return null;
  // A log without data is still a log: it gets an empty payload
  const payloadJSON = log.payloadJSON ?? "{}";
  return {
    timestamp: log.timestamp!,
    tag: log.tag!,
    verbosity: log.verbosity!,
    message: log.message!,
    payloadJSON,
    payload: toPayload(payloadJSON),
  };
}

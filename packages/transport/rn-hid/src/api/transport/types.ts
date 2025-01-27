import { type LogLevel } from "@ledgerhq/device-management-kit";

export type Log = {
  level: LogLevel;
  message: string;
  tag: string;
  jsonPayload: Record<string, string>;
};

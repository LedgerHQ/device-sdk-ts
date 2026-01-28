import { type DevToolsLog } from "@ledgerhq/device-management-kit-devtools-core";

export type { DevToolsLog };

export type LogData = DevToolsLog & {
  payload: string | Record<string, unknown>;
};

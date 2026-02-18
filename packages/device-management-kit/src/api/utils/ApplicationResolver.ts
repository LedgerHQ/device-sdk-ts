import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";

export type AppConfig = Record<string, unknown> & {
  readonly version: string;
};

export type ResolvedApp = {
  readonly isCompatible: boolean;
  readonly version: string;
};

export interface ApplicationResolver {
  resolve(deviceState: DeviceSessionState, appConfig: AppConfig): ResolvedApp;
}

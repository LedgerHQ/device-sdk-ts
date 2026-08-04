import {
  type DeviceActionState,
  type GetOsVersionResponse,
  type GoToDashboardDAError,
  type GoToDashboardDAIntermediateValue,
  type GoToDashboardDARequiredInteraction,
  type UserInteractionRequired,
  type WaitForAppAndVersionDAError,
  type WaitForAppAndVersionDAIntermediateValue,
  type WaitForAppAndVersionDARequiredInteraction,
} from "@ledgerhq/device-management-kit";

import { type ResolveOsUpdatePathDAErrors } from "./ResolveOsUpdatePathDeviceActionErrors";

export type McuFirmware = {
  id: number;
  name: string;
  fromBootloaderVersion: string;
};

export type BaseFirmware = {
  id: number;
  perso: string;
  hash: string | null;
};

export type OsuFirmware = BaseFirmware & {
  notes: string | null;
  firmware: string;
  firmwareKey: string;
  nextFinalFirmware: number;
};

export type FinalFirmware = BaseFirmware & {
  version: string;
  bytes: number | null;
  firmware: string | null;
  firmwareKey: string | null;
  mcuVersions: number[];
};

export type OsUpdate = {
  osuFirmware: OsuFirmware;
  finalFirmware: FinalFirmware;
  shouldFlashMcu: boolean;
};

export type DeviceInfos = {
  targetId: number;
  seVersion: string;
  mcuSephVersion: string;
  isOsu: boolean;
};

export type ResolveOsUpdatePathDAInput = {
  unlockTimeout: number;
};

export type ResolveOsUpdatePathDAOutput = OsUpdate[];

export type ResolveOsUpdatePathDAError =
  | WaitForAppAndVersionDAError
  | GoToDashboardDAError
  | ResolveOsUpdatePathDAErrors;

export type ResolveOsUpdatePathDAIntermediateValue = (
  | WaitForAppAndVersionDAIntermediateValue
  | GoToDashboardDAIntermediateValue
  | {
      readonly requiredUserInteraction: ResolveOsUpdatePathDARequiredInteraction;
    }
) & {
  step: ResolveOsUpdatePathSteps;
};

export type ResolveOsUpdatePathDARequiredInteraction =
  | WaitForAppAndVersionDARequiredInteraction
  | GoToDashboardDARequiredInteraction
  | UserInteractionRequired.None;

export type ResolveOsUpdatePathDAInternalState = {
  error: ResolveOsUpdatePathDAError | null;
  currentApp: string | null;
  getOsVersionResponse: GetOsVersionResponse | null;
  osUpdates: OsUpdate[];
};

export type ResolveOsUpdatePathDAState = DeviceActionState<
  ResolveOsUpdatePathDAOutput,
  ResolveOsUpdatePathDAError,
  ResolveOsUpdatePathDAIntermediateValue
>;

export enum ResolveOsUpdatePathSteps {
  Idle = "idle",
  WaitForAppAndVersion = "waitForAppAndVersion",
  GoToDashboard = "goToDashboard",
  GetOsVersion = "getOsVersion",
  ResolveOsUpdatePath = "resolveOsUpdatePath",
}

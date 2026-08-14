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

import { type OsUpdate } from "@api/device-action/OsUpdate/Shared/types";

import { type ResolveOsUpdatePathDAErrors } from "./ResolveOsUpdatePathDeviceActionErrors";

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

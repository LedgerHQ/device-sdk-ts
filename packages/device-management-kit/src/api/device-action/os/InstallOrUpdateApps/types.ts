import type { CommandErrorResult } from "@api/command/model/CommandResult";
import type { DeviceModelId } from "@api/device/DeviceModel";
import type { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import type { OutOfMemoryDAError } from "@api/device-action/os/Errors";
import type {
  GetDeviceMetadataDAError,
  GetDeviceMetadataDAIntermediateValue,
} from "@api/device-action/os/GetDeviceMetadata/types";
import type { GoToDashboardDAInput } from "@api/device-action/os/GoToDashboard/types";
import type { InstallAppDAError } from "@api/secure-channel/device-action/InstallApp/types";
import type { Application } from "@internal/manager-api/model/Application";

/**
 * An application version used as application constraint should either be a valid semantic versioning formatted
 * string, or "latest" to ensure the app is always up-to-date.
 */
export type ApplicationVersionConstraint =
  | `${number}.${number}.${number}`
  | `${number}.${number}.${number}-${string}`
  | `${number}.${number}.${number}+${string}`
  | `${number}.${number}.${number}-${string}+${string}`
  | "latest";

export type ApplicationConstraint = {
  /**
   * Required minimal version of the application, if already installed on the device.
   */
  readonly minVersion: ApplicationVersionConstraint;

  /**
   * List of device models that require the minVersion.
   */
  readonly applicableModels?: DeviceModelId[];

  /**
   * List of device models that do not require the minVersion.
   */
  readonly exemptModels?: DeviceModelId[];
};

export type ApplicationDependency = {
  /**
   * Name of the application to install.
   */
  readonly name: string;

  /**
   * List of constraints for the application.
   * If no constraints are provided, no version checks are performed.
   * If the current device model is not concerned by any listed contraints, no version checks are performed.
   */
  readonly constraints?: ApplicationConstraint[];
};

export type InstallPlan = {
  readonly installPlan: Application[];
  readonly alreadyInstalled: string[];
  readonly missingApplications: string[];
  readonly currentIndex: number;
  readonly currentProgress: number;
};

export type InstallOrUpdateAppsDAOutput = {
  readonly successfullyInstalled: Application[];
  readonly alreadyInstalled: string[];
  readonly missingApplications: string[];
};

export type InstallOrUpdateAppsDAInput = GoToDashboardDAInput & {
  readonly applications: ApplicationDependency[];
  readonly allowMissingApplication: boolean;
};

export type InstallOrUpdateAppsDAError =
  | GetDeviceMetadataDAError
  | InstallAppDAError
  | OutOfMemoryDAError
  | CommandErrorResult["error"];

export type InstallOrUpdateAppsDAIntermediateValue =
  GetDeviceMetadataDAIntermediateValue & {
    installPlan: InstallPlan | null;
  };

export type InstallOrUpdateAppsDAState = DeviceActionState<
  InstallOrUpdateAppsDAOutput,
  InstallOrUpdateAppsDAError,
  InstallOrUpdateAppsDAIntermediateValue
>;

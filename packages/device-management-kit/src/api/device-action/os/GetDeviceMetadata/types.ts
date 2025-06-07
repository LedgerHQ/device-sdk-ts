import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import {
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDARequiredInteraction,
} from "@api/device-action/os/GoToDashboard/types";
import {
  type ListAppsDAError,
  type ListAppsDARequiredInteraction,
} from "@api/device-action/os/ListApps/types";
import {
  type Catalog,
  type CustomImage,
  type FirmwareUpdateContext,
  type FirmwareVersion,
  type InstalledLanguagePackage,
} from "@api/device-session/DeviceSessionState";
import {
  type ListInstalledAppsDAError,
  type ListInstalledAppsDARequiredInteraction,
} from "@api/secure-channel/device-action/ListInstalledApps/types";
import { type Application } from "@internal/manager-api/model/Application";
import { type SecureChannelDAErrors } from "@internal/secure-channel/model/Errors";

export type GetDeviceMetadataDAOutput = {
  readonly firmwareVersion: FirmwareVersion;
  readonly firmwareUpdateContext: FirmwareUpdateContext;
  readonly applications: Application[];
  readonly applicationsUpdates: Application[];
  readonly installedLanguages: InstalledLanguagePackage[];
  readonly catalog: Catalog;
  readonly customImage: CustomImage;
};

export type GetDeviceMetadataDAInput = GoToDashboardDAInput & {
  readonly useSecureChannel?: boolean;
  readonly forceUpdate?: boolean;
};

export type GetDeviceMetadataDAError =
  | GoToDashboardDAError
  | ListAppsDAError
  | ListInstalledAppsDAError
  | SecureChannelDAErrors
  | CommandErrorResult["error"];

export type GetDeviceMetadataDARequiredInteraction =
  | GoToDashboardDARequiredInteraction
  | ListAppsDARequiredInteraction
  | ListInstalledAppsDARequiredInteraction;

export type GetDeviceMetadataDAIntermediateValue = {
  requiredUserInteraction: GetDeviceMetadataDARequiredInteraction;
};

export type GetDeviceMetadataDAState = DeviceActionState<
  GetDeviceMetadataDAOutput,
  GetDeviceMetadataDAError,
  GetDeviceMetadataDAIntermediateValue
>;

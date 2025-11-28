import type { CommandErrorResult } from "@api/command/model/CommandResult";
import type { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import type {
  UnknownDAError,
  UnsupportedFirmwareDAError,
} from "@api/device-action/os/Errors";
import type {
  GetDeviceMetadataDAOutput,
  GetDeviceMetadataDARequiredInteraction,
} from "@api/device-action/os/GetDeviceMetadata/types";
import type { GetDeviceStatusDAInput } from "@api/device-action/os/GetDeviceStatus/types";
import type {
  ApplicationDependency,
  InstallOrUpdateAppsDAError,
  InstallOrUpdateAppsDAOutput,
  InstallOrUpdateAppsDARequiredInteraction,
  InstallPlan,
} from "@api/device-action/os/InstallOrUpdateApps/types";
import type {
  OpenAppDAError,
  OpenAppDARequiredInteraction,
} from "@api/device-action/os/OpenAppDeviceAction/types";

export const openAppWithDependenciesDAStateStep = Object.freeze({
  GET_DEVICE_METADATA: "os.openAppWithDependencies.steps.getDeviceMetadata",
  INSTALL_OR_UPDATE_APPS:
    "os.openAppWithDependencies.steps.installOrUpdateApps",
  OPEN_APP: "os.openAppWithDependencies.steps.openApp",
} as const);

export type OpenAppWithDependenciesDAStateStep =
  (typeof openAppWithDependenciesDAStateStep)[keyof typeof openAppWithDependenciesDAStateStep];

export type OpenAppWithDependenciesDAOutput = {
  deviceMetadata: GetDeviceMetadataDAOutput;
  installResult: InstallOrUpdateAppsDAOutput;
};

export type OpenAppWithDependenciesDAInput = GetDeviceStatusDAInput & {
  readonly application: ApplicationDependency;
  readonly dependencies: ApplicationDependency[];
  readonly requireLatestFirmware?: boolean;
};

export type OpenAppWithDependenciesDAError =
  | InstallOrUpdateAppsDAError
  | OpenAppDAError
  | UnknownDAError
  | UnsupportedFirmwareDAError
  | CommandErrorResult["error"];

export type OpenAppWithDependenciesDARequiredInteraction =
  | GetDeviceMetadataDARequiredInteraction
  | InstallOrUpdateAppsDARequiredInteraction
  | OpenAppDARequiredInteraction;

export type OpenAppWithDependenciesDAIntermediateValue = {
  requiredUserInteraction: OpenAppWithDependenciesDARequiredInteraction;
  installPlan: InstallPlan | null;
  deviceId?: Uint8Array;
  step: OpenAppWithDependenciesDAStateStep;
};

export type OpenAppWithDependenciesDAState = DeviceActionState<
  OpenAppWithDependenciesDAOutput,
  OpenAppWithDependenciesDAError,
  OpenAppWithDependenciesDAIntermediateValue
>;

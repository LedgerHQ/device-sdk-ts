import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import {
  type GetDeviceMetadataDAError,
  type GetDeviceMetadataDAIntermediateValue,
} from "@api/device-action/os/GetDeviceMetadata/types";
import { type GoToDashboardDAInput } from "@api/device-action/os/GoToDashboard/types";
import { type LanguagePackage } from "@internal/manager-api/model/Language";

export type Language =
  | "french"
  | "english"
  | "spanish"
  | "brazilian"
  | "german"
  | "russian"
  | "turkish"
  | "thai";

export const installLanguagePackageDAStateStep = Object.freeze({
  DEVICE_READY: "os.installLanguagePackage.steps.deviceReady",
  GET_DEVICE_METADATA: "os.installLanguagePackage.steps.getDeviceMetadata",
  PREPARE_LANGUAGE_PACK_INSTALL:
    "os.installLanguagePackage.steps.prepareLanguagePackInstall",
} as const);

export type InstallLanguagePackageDAInput = GoToDashboardDAInput & {
  readonly language: Language;
};

export type InstallLanguagePackageDAOutput = LanguagePackage | undefined;

export type InstallLanguagePackageDAIntermediateValue =
  | GetDeviceMetadataDAIntermediateValue
  | {
      readonly requiredUserInteraction: UserInteractionRequired.None;
      readonly step: (typeof installLanguagePackageDAStateStep)[keyof typeof installLanguagePackageDAStateStep];
    };

export type InstallLanguagePackageDAError =
  | GetDeviceMetadataDAError
  | UnknownDAError;

export type InstallLanguagePackageDAState = DeviceActionState<
  InstallLanguagePackageDAOutput,
  InstallLanguagePackageDAError,
  InstallLanguagePackageDAIntermediateValue
>;

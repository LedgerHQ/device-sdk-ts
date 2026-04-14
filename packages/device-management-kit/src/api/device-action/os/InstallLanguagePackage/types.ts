import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type MissingLanguagePackageDAError,
  type MissingLanguagePackagesForOSDAError,
} from "@api/device-action/os/Errors";
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
  DELETE_CURRENT_LANGUAGE_PACK:
    "os.installLanguagePackage.steps.deleteCurrentLanguagePack",
  INSTALL_LANGUAGE_PACK: "os.installLanguagePackage.steps.installLanguagePack",
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
      readonly progress?: number;
    };

export type InstallLanguagePackageDAError =
  | GetDeviceMetadataDAError
  | MissingLanguagePackagesForOSDAError
  | MissingLanguagePackageDAError;

export type InstallLanguagePackageDAState = DeviceActionState<
  InstallLanguagePackageDAOutput,
  InstallLanguagePackageDAError,
  InstallLanguagePackageDAIntermediateValue
>;

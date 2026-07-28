import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type DeleteLanguagePackDAError,
  type MissingLanguagePackageDAError,
  type MissingLanguagePackagesForOSDAError,
  type OutOfMemoryDAError,
  type RefusedByUserDAError,
  type UnknownDAError,
} from "@api/device-action/os/Errors";
import {
  type GetDeviceMetadataDAError,
  type GetDeviceMetadataDAIntermediateValue,
} from "@api/device-action/os/GetDeviceMetadata/types";
import { type GoToDashboardDAInput } from "@api/device-action/os/GoToDashboard/types";

export type Language =
  | "french"
  | "english"
  | "spanish"
  | "brazilian"
  | "german"
  | "russian"
  | "turkish"
  | "thai";

export const LANGUAGE_ID_TO_LANGUAGE: Record<number, Language> = {
  0: "english",
  1: "french",
  2: "spanish",
  3: "brazilian",
  4: "german",
  5: "russian",
  6: "turkish",
  7: "thai",
};

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

export type InstallLanguagePackageDAOutput = undefined;

export type InstallLanguagePackageDAGetDeviceMetadataIntermediateValue = Omit<
  GetDeviceMetadataDAIntermediateValue,
  "step"
> & {
  readonly step: typeof installLanguagePackageDAStateStep.GET_DEVICE_METADATA;
};

export type InstallLanguagePackageDAIntermediateValue =
  | GetDeviceMetadataDAIntermediateValue
  | InstallLanguagePackageDAGetDeviceMetadataIntermediateValue
  | {
      readonly requiredUserInteraction: UserInteractionRequired.None;
      readonly step: Exclude<
        (typeof installLanguagePackageDAStateStep)[keyof typeof installLanguagePackageDAStateStep],
        typeof installLanguagePackageDAStateStep.GET_DEVICE_METADATA
      >;
      readonly progress?: number;
    };

export type InstallLanguagePackageDAError =
  | GetDeviceMetadataDAError
  | MissingLanguagePackagesForOSDAError
  | MissingLanguagePackageDAError
  | DeleteLanguagePackDAError
  | RefusedByUserDAError // from InstallLanguagePackageTask
  | OutOfMemoryDAError // from InstallLanguagePackageTask
  | UnknownDAError; // from InstallLanguagePackageTask (network error, invalid APDU, etc.)

export type InstallLanguagePackageDAState = DeviceActionState<
  InstallLanguagePackageDAOutput,
  InstallLanguagePackageDAError,
  InstallLanguagePackageDAIntermediateValue
>;

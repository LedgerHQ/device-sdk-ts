import {
  type ErrorLanguageNotFound,
  type InvalidGetFirmwareMetadataResponseError,
} from "@api/command/Errors";
import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type DeleteLanguagePackCommandError } from "@api/command/os/DeleteLanguagePackCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import {
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
} from "@api/device-action/os/GoToDashboard/types";
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
  GO_TO_DASHBOARD: "os.installLanguagePackage.steps.goToDashboard",
  GET_DEVICE_INFO: "os.installLanguagePackage.steps.getDeviceInfo",
  DELETE_ALL_LANGUAGE_PACKS:
    "os.installLanguagePackage.steps.deleteAllLanguagePacks",
  RESOLVE_LANGUAGE_PACKAGE:
    "os.installLanguagePackage.steps.resolveLanguagePackage",
} as const);

export type InstallLanguagePackageDAStateStep =
  (typeof installLanguagePackageDAStateStep)[keyof typeof installLanguagePackageDAStateStep];

/** Resolved catalog entry, or `undefined` after deleting all language packs (`language === "english"`). */
export type InstallLanguagePackageDAOutput = LanguagePackage | undefined;

export type InstallLanguagePackageDAInput = GoToDashboardDAInput & {
  readonly language: Language;
};

export type InstallLanguagePackageDAError =
  | GoToDashboardDAError
  | UnknownDAError
  | ErrorLanguageNotFound
  | InvalidGetFirmwareMetadataResponseError
  | DeleteLanguagePackCommandError
  | CommandErrorResult["error"];

export type InstallLanguagePackageDARequiredInteraction =
  UserInteractionRequired.None;

export type InstallLanguagePackageDAIntermediateValue =
  | GoToDashboardDAIntermediateValue
  | {
      readonly requiredUserInteraction: InstallLanguagePackageDARequiredInteraction;
      readonly step: InstallLanguagePackageDAStateStep;
    };

export type InstallLanguagePackageDAState = DeviceActionState<
  InstallLanguagePackageDAOutput,
  InstallLanguagePackageDAError,
  InstallLanguagePackageDAIntermediateValue
>;

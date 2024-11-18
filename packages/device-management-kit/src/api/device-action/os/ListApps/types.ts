import { type CommandErrorResult } from "@api/command/model/CommandResult";
import {
  type ListAppsErrorCodes,
  type ListAppsResponse,
} from "@api/command/os/ListAppsCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import {
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
} from "@api/device-action/os/GoToDashboard/types";

export type ListAppsDAOutput = ListAppsResponse;
export type ListAppsDAInput = GoToDashboardDAInput;

export type ListAppsDAError =
  | GoToDashboardDAError
  | UnknownDAError
  | CommandErrorResult<ListAppsErrorCodes>["error"];

export type ListAppsDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.AllowListApps;

export type ListAppsDAIntermediateValue =
  | GoToDashboardDAIntermediateValue
  | {
      readonly requiredUserInteraction: ListAppsDARequiredInteraction;
    };

export type ListAppsDAState = DeviceActionState<
  ListAppsDAOutput,
  ListAppsDAError,
  ListAppsDAIntermediateValue
>;

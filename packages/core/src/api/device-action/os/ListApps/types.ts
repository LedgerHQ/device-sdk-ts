import { CommandErrorResult } from "@api/command/model/CommandResult";
import {
  ListAppsCommandErrorCodes,
  ListAppsResponse,
} from "@api/command/os/ListAppsCommand";
import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import {
  GoToDashboardDAError,
  GoToDashboardDAInput,
  GoToDashboardDAIntermediateValue,
} from "@api/device-action/os/GoToDashboard/types";

export type ListAppsDAOutput = ListAppsResponse;
export type ListAppsDAInput = GoToDashboardDAInput;

export type ListAppsDAError =
  | GoToDashboardDAError
  | UnknownDAError
  | CommandErrorResult<ListAppsCommandErrorCodes>["error"];

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

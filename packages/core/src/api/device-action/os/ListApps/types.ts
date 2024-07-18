import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import {
  GoToDashboardDAError,
  GoToDashboardDAInput,
  GoToDashboardDAIntermediateValue,
} from "@api/device-action/os/GoToDashboard/types";
import { SdkError } from "@api/Error";

export type ListAppsDAOutput = ListAppsResponse;
export type ListAppsDAInput = GoToDashboardDAInput;

export type ListAppsDAError = GoToDashboardDAError | UnknownDAError | SdkError; /// TODO: remove, we should have an exhaustive list of errors

export type ListAppsDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.AllowListApps;

export type ListAppsDAIntermediateValue =
  | GoToDashboardDAIntermediateValue
  | {
      requiredUserInteraction: ListAppsDARequiredInteraction;
    };

export type ListAppsDAState = DeviceActionState<
  ListAppsDAOutput,
  ListAppsDAError,
  ListAppsDAIntermediateValue
>;

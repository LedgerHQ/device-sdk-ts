import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type ListAppsErrorCodes } from "@api/command/os/ListAppsCommand";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { type UnknownDAError } from "@api/device-action/os/Errors";
import {
  type ListAppsDAError,
  type ListAppsDAInput,
  type ListAppsDAIntermediateValue,
} from "@api/device-action/os/ListApps/types";
import { type HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { type Application } from "@internal/manager-api/model/ManagerApiType";

export type ListAppsWithMetadataDAOutput = Array<Application | null>;
export type ListAppsWithMetadataDAInput = ListAppsDAInput;

export type ListAppsWithMetadataDAError =
  | ListAppsDAError
  | UnknownDAError
  | HttpFetchApiError
  | CommandErrorResult<ListAppsErrorCodes>["error"];

export type ListAppsWithMetadataDARequiredInteraction =
  UserInteractionRequired.None;

export type ListAppsWithMetadataDAIntermediateValue =
  | ListAppsDAIntermediateValue
  | {
      requiredUserInteraction: ListAppsWithMetadataDARequiredInteraction;
    };

export type ListAppsWithMetadataDAState = DeviceActionState<
  ListAppsWithMetadataDAOutput,
  ListAppsWithMetadataDAError,
  ListAppsWithMetadataDAIntermediateValue
>;

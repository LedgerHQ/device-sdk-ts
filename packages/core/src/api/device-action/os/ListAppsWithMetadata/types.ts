import { CommandErrorResult } from "@api/command/model/CommandResult";
import { ListAppsErrorCodes } from "@api/command/os/ListAppsCommand";
import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import {
  ListAppsDAError,
  ListAppsDAInput,
  ListAppsDAIntermediateValue,
} from "@api/device-action/os/ListApps/types";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { Application } from "@internal/manager-api/model/ManagerApiType";

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

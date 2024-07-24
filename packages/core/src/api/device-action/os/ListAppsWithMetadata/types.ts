import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import {
  ListAppsDAError,
  ListAppsDAInput,
  ListAppsDAIntermediateValue,
} from "@api/device-action/os/ListApps/types";
import { SdkError } from "@api/Error";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

export type ListAppsWithMetadataDAOutput = ApplicationEntity[];
export type ListAppsWithMetadataDAInput = ListAppsDAInput;

export type ListAppsWithMetadataDAError =
  | ListAppsDAError
  | UnknownDAError
  | SdkError; /// TODO: remove, we should have an exhaustive list of errors

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

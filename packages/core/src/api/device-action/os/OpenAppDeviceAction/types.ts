import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import { SdkError } from "@api/Error";

export type OpenAppDAOutput = void;

export type OpenAppDAInput = {
  appName: string;
};

export type OpenAppDAError =
  | DeviceNotOnboardedError
  | DeviceLockedError
  | UnknownDAError
  | SdkError; /// TODO: remove, we should have an exhaustive list of errors

type OpenAppDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.UnlockDevice
  | UserInteractionRequired.ConfirmOpenApp;

export type OpenAppDAIntermediateValue = {
  requiredUserInteraction: OpenAppDARequiredInteraction;
};

export type OpenAppDAState = DeviceActionState<
  OpenAppDAOutput,
  OpenAppDAError,
  OpenAppDAIntermediateValue
>;

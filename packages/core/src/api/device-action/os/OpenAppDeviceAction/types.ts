import { DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { SdkError } from "@api/Error";

import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownOpenAppDAError,
} from "./errors";

export type OpenAppDAOutput = void;

export type OpenAppDAInput = {
  appName: string;
};

export type OpenAppDAError =
  | DeviceNotOnboardedError
  | DeviceLockedError
  | UnknownOpenAppDAError
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

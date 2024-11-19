import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetPublicKeyCommandResponse } from "@api/app-binder/GetPublicKeyCommandTypes";

type GetPublicKeyDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetPublicKeyDAOutput =
  SendCommandInAppDAOutput<GetPublicKeyCommandResponse>;
export type GetPublicKeyDAError = SendCommandInAppDAError<never>; // TODO: add specific command errors when error handling for commands is properly implemented
export type GetPublicKeyDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetPublicKeyDAUserInteractionRequired>;

export type GetPublicKeyDAReturnType = ExecuteDeviceActionReturnType<
  GetPublicKeyDAOutput,
  GetPublicKeyDAError,
  GetPublicKeyDAIntermediateValue
>;

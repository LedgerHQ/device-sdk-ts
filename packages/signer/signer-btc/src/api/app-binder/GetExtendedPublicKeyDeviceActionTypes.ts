import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type GetExtendedPublicKeyCommandArgs,
  type GetExtendedPublicKeyCommandResponse,
} from "@internal/app-binder/command/GetExtendedPublicKeyCommand";

type GetExtendedPublicKeyDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetExtendedPublicKeyDAOutput =
  SendCommandInAppDAOutput<GetExtendedPublicKeyCommandResponse>;

export type GetExtendedPublicKeyDAError = SendCommandInAppDAError;

export type GetExtendedDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetExtendedPublicKeyDARequiredInteraction>;

export type GetExtendedPublicKeyDAInput = GetExtendedPublicKeyCommandArgs;

export type GetExtendedPublicKeyReturnType = ExecuteDeviceActionReturnType<
  GetExtendedPublicKeyDAOutput,
  GetExtendedPublicKeyDAError,
  GetExtendedDAIntermediateValue
>;

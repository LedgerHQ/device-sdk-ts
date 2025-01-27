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
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";

type GetExtendedPublicKeyDARequiredInteraction =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetExtendedPublicKeyDAOutput =
  SendCommandInAppDAOutput<GetExtendedPublicKeyCommandResponse>;

export type GetExtendedPublicKeyDAError =
  SendCommandInAppDAError<BtcErrorCodes>;

export type GetExtendedDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetExtendedPublicKeyDARequiredInteraction>;

export type GetExtendedPublicKeyDAInput = GetExtendedPublicKeyCommandArgs;

export type GetExtendedPublicKeyDAReturnType = ExecuteDeviceActionReturnType<
  GetExtendedPublicKeyDAOutput,
  GetExtendedPublicKeyDAError,
  GetExtendedDAIntermediateValue
>;

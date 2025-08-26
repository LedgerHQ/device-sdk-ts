import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type PublicKey } from "@api/model/PublicKey";
import { type CantonAppErrorCodes } from "@internal/app-binder/command/utils/CantonApplicationErrors";
import { GetAddressCommandArgs, GetAddressCommandResponse } from "@internal/app-binder/command/GetAddressCommand";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetAddressDAOutput = SendCommandInAppDAOutput<GetAddressCommandResponse>;
export type GetAddressDAError = SendCommandInAppDAError<CantonAppErrorCodes>;
export type GetAddressDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAInput = GetAddressCommandArgs;

export type GetAddressDAInternalState = {
  readonly publicKey: PublicKey | null;
  readonly error: CantonAppErrorCodes | null;
};

export type GetAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetAddressDAOutput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;

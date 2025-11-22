import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAddressCommandResponse } from "@api/app-binder/GetAddressCommandTypes";
import { type CosmosAppErrorCodes } from "@internal/app-binder/command/utils/CosmosAppErrors";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetAddressDAOutput =
  SendCommandInAppDAOutput<GetAddressCommandResponse>;

export type GetAddressDAError = SendCommandInAppDAError<CosmosAppErrorCodes>;

export type GetAddressDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetAddressDAOutput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;

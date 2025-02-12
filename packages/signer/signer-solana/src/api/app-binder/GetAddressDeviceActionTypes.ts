import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type PublicKey } from "@api/model/PublicKey";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetAddressDAOutput = SendCommandInAppDAOutput<PublicKey>;
export type GetAddressDAError = SendCommandInAppDAError<SolanaAppErrorCodes>;
export type GetAddressDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetAddressDAOutput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;

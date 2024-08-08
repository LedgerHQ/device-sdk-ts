import {
  CommandResult,
  type ExecuteDeviceActionReturnType,
  GlobalCommandErrorStatusCode,
  type SendCommandInAppDAError,
  type SendCommandInAppDAInput,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  UserInteractionRequired,
} from "@ledgerhq/device-sdk-core";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetAddressDAInput = SendCommandInAppDAInput<
  GetAddressCommandResponse,
  GetAddressCommandArgs,
  GetAddressDAUserInteractionRequired,
  GlobalCommandErrorStatusCode
>;
export type GetAddressDAOutput = SendCommandInAppDAOutput<
  CommandResult<GetAddressCommandResponse, GlobalCommandErrorStatusCode>
>;
export type GetAddressDAError = SendCommandInAppDAError<never>; // TODO: add specific command errors when error handling for commands is properly implemented
export type GetAddressDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetAddressDAOutput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;

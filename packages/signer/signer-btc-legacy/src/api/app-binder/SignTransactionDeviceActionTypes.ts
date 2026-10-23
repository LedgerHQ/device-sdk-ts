import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type HexaString,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

export type SignTransactionDAOutput = HexaString;

export type SignTransactionDAError<ErrorCodes extends string> =
  | OpenAppDAError
  | CommandErrorResult<ErrorCodes>["error"];

export type SignTransactionDAIntermediateValue = {
  readonly requiredUserInteraction:
    | OpenAppDARequiredInteraction
    | UserInteractionRequired.SignTransaction;
};

export type SignTransactionDAReturnType<ErrorCodes extends string> =
  ExecuteDeviceActionReturnType<
    SignTransactionDAOutput,
    SignTransactionDAError<ErrorCodes>,
    SignTransactionDAIntermediateValue
  >;

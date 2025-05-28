import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetVersionCommandResponse } from "@api/app-binder/GetVersionCommandTypes";
import { type LedgerSyncErrorCodes } from "@internal/app-binder/command/utils/ledgerSyncErrors";

type GetVersionDAUserInteractionRequired = UserInteractionRequired.None;

export type GetVersionDAOutput =
  SendCommandInAppDAOutput<GetVersionCommandResponse>;

export type GetVersionDAError =
  | OpenAppDAError
  | CommandErrorResult<LedgerSyncErrorCodes>["error"];

export type GetVersionDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetVersionDAUserInteractionRequired>;

export type GetVersionDAReturnType = ExecuteDeviceActionReturnType<
  GetVersionDAOutput,
  GetVersionDAError,
  GetVersionDAIntermediateValue
>;

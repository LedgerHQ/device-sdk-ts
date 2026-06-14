import { type CommandErrorResult } from "@api/command/model/CommandResult";
import { type ContactsErrorCodes } from "@api/contacts/ContactsErrors";
import { type RenameContactResult } from "@api/contacts/model/RenameContactArgs";
import { type ExecuteDeviceActionReturnType } from "@api/device-action/DeviceAction";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
} from "@api/device-action/os/OpenAppDeviceAction/types";

export type RenameContactDAOutput = RenameContactResult;

export type RenameContactDAError =
  | OpenAppDAError
  | CommandErrorResult<ContactsErrorCodes>["error"];

type RenameContactDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RenameContactDAIntermediateValue = {
  requiredUserInteraction: RenameContactDARequiredInteraction;
};

export type RenameContactDAState = DeviceActionState<
  RenameContactDAOutput,
  RenameContactDAError,
  RenameContactDAIntermediateValue
>;

export type RenameContactDAReturnType = ExecuteDeviceActionReturnType<
  RenameContactDAOutput,
  RenameContactDAError,
  RenameContactDAIntermediateValue
>;

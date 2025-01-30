import {
  type CommandErrorResult,
  type CommandResult,
} from "@api/command/model/CommandResult";
import { type InternalApi } from "@api/device-action/DeviceAction";
import {
  type OpenAppDAError,
  type OpenAppDAIntermediateValue,
} from "@api/device-action/os/OpenAppDeviceAction/types";

export type CallTaskInAppDAOutput<TaskResponse> = TaskResponse;

export type CallTaskInAppDAInput<
  TaskResponse,
  TaskErrorCodes,
  UserInteraction,
> = {
  readonly task: (
    internalApi: InternalApi,
  ) => Promise<CommandResult<TaskResponse, TaskErrorCodes>>;
  readonly appName: string;
  readonly requiredUserInteraction: UserInteraction;
  readonly compatibleAppNames?: string[];
};

export type CallTaskInAppDAError<TaskErrorCodes = void> =
  | OpenAppDAError
  | CommandErrorResult<TaskErrorCodes>["error"];

export type CallTaskInAppDAIntermediateValue<UserInteraction> =
  | { readonly requiredUserInteraction: UserInteraction }
  | OpenAppDAIntermediateValue;

export type CallTaskInAppDAInternalState<TaskResponse, TaskErrorCodes> = {
  readonly taskResponse: TaskResponse | null;
  readonly error: CallTaskInAppDAError<TaskErrorCodes> | null;
};

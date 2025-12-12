import {
  type CommandErrorResult,
  type CommandResult,
} from "@api/command/model/CommandResult";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type OpenAppDAError,
  type OpenAppDAIntermediateValue,
} from "@api/device-action/os/OpenAppDeviceAction/types";

export const callTaskInAppDAStateStep = Object.freeze({
  OPEN_APP: "os.callTaskInApp.steps.openApp",
  CALL_TASK: "os.callTaskInApp.steps.callTask",
} as const);

export type CallTaskInAppDAStateStep =
  (typeof callTaskInAppDAStateStep)[keyof typeof callTaskInAppDAStateStep];

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
  readonly skipOpenApp: boolean;
  readonly requiredUserInteraction: UserInteraction;
};

export type CallTaskInAppDAError<TaskErrorCodes = void> =
  | OpenAppDAError
  | CommandErrorResult<TaskErrorCodes>["error"];

export type CallTaskInAppDARequiredInteraction = UserInteractionRequired.None;

export type CallTaskInAppDAIntermediateValue<UserInteraction> =
  | {
      readonly requiredUserInteraction:
        | UserInteraction
        | CallTaskInAppDARequiredInteraction;
      readonly step: CallTaskInAppDAStateStep;
    }
  | OpenAppDAIntermediateValue;

export type CallTaskInAppDAInternalState<TaskResponse, TaskErrorCodes> = {
  readonly taskResponse: TaskResponse | null;
  readonly error: CallTaskInAppDAError<TaskErrorCodes> | null;
};

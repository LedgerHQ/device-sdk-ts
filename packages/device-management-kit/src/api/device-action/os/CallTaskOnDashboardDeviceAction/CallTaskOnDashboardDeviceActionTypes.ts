import { type InternalApi } from "@api/device-action/DeviceAction";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type GoToDashboardDAError,
  type GoToDashboardDAIntermediateValue,
} from "@api/device-action/os/GoToDashboard/types";
import { type DmkError } from "@api/Error";
import { type DmkResult } from "@api/model/DmkResult";

export const callTaskOnDashboardDAStateStep = Object.freeze({
  GO_TO_DASHBOARD: "os.callTaskOnDashboard.steps.goToDashboard",
  CALL_TASK: "os.callTaskOnDashboard.steps.callTask",
} as const);

export type CallTaskOnDashboardDAStateStep =
  (typeof callTaskOnDashboardDAStateStep)[keyof typeof callTaskOnDashboardDAStateStep];

export type CallTaskOnDashboardDAOutput<TaskResponse> = TaskResponse;

export type CallTaskOnDashboardDAInput<
  TaskResponse,
  TaskError extends DmkError,
  UserInteraction,
> = {
  readonly task: (
    internalApi: InternalApi,
  ) => Promise<DmkResult<TaskResponse, TaskError>>;
  readonly requiredUserInteraction: UserInteraction;
  /** Forwarded to the GoToDashboard sub-action's device-status check. */
  readonly unlockTimeout?: number;
};

export type CallTaskOnDashboardDAError<TaskError extends DmkError = DmkError> =
  | GoToDashboardDAError
  | TaskError;

export type CallTaskOnDashboardDARequiredInteraction =
  UserInteractionRequired.None;

export type CallTaskOnDashboardDAIntermediateValue<UserInteraction> =
  | {
      readonly requiredUserInteraction:
        | UserInteraction
        | CallTaskOnDashboardDARequiredInteraction;
      readonly step: CallTaskOnDashboardDAStateStep;
    }
  | GoToDashboardDAIntermediateValue;

export type CallTaskOnDashboardDAInternalState<
  TaskResponse,
  TaskError extends DmkError = DmkError,
> = {
  readonly taskResponse: TaskResponse | null;
  readonly error: CallTaskOnDashboardDAError<TaskError> | null;
};

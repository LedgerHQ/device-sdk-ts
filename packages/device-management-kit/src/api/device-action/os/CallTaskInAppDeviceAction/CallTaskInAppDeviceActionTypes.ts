import { type InternalApi } from "@api/device-action/DeviceAction";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type OpenAppDAError,
  type OpenAppDAIntermediateValue,
} from "@api/device-action/os/OpenAppDeviceAction/types";
import { type DmkError } from "@api/Error";
import { type DmkResult } from "@api/model/DmkResult";

export const callTaskInAppDAStateStep = Object.freeze({
  OPEN_APP: "os.callTaskInApp.steps.openApp",
  CALL_TASK: "os.callTaskInApp.steps.callTask",
} as const);

export type CallTaskInAppDAStateStep =
  (typeof callTaskInAppDAStateStep)[keyof typeof callTaskInAppDAStateStep];

export type CallTaskInAppDAOutput<TaskResponse> = TaskResponse;

export type CallTaskInAppDAInput<
  TaskResponse,
  TaskError extends DmkError,
  UserInteraction,
> = {
  readonly task: (
    internalApi: InternalApi,
  ) => Promise<DmkResult<TaskResponse, TaskError>>;
  readonly appName: string;
  readonly skipOpenApp: boolean;
  readonly requiredUserInteraction: UserInteraction;
};

export type CallTaskInAppDAError<TaskError extends DmkError = DmkError> =
  | OpenAppDAError
  | TaskError;

export type CallTaskInAppDARequiredInteraction = UserInteractionRequired.None;

export type CallTaskInAppDAIntermediateValue<UserInteraction> =
  | {
      readonly requiredUserInteraction:
        | UserInteraction
        | CallTaskInAppDARequiredInteraction;
      readonly step: CallTaskInAppDAStateStep;
    }
  | OpenAppDAIntermediateValue;

export type CallTaskInAppDAInternalState<
  TaskResponse,
  TaskError extends DmkError = DmkError,
> = {
  readonly taskResponse: TaskResponse | null;
  readonly error: CallTaskInAppDAError<TaskError> | null;
};

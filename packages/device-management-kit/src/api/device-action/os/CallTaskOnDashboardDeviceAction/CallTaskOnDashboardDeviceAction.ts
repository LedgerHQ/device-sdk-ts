import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import { type DmkError } from "@api/Error";
import { type DmkResult, isSuccessDmkResult } from "@api/model/DmkResult";

import {
  type CallTaskOnDashboardDAError,
  type CallTaskOnDashboardDAInput,
  type CallTaskOnDashboardDAIntermediateValue,
  type CallTaskOnDashboardDAInternalState,
  type CallTaskOnDashboardDAOutput,
  callTaskOnDashboardDAStateStep,
} from "./CallTaskOnDashboardDeviceActionTypes";

/**
 * Ensures the device is on the dashboard (closing any running app), then calls
 * a task. The mirror of {@link CallTaskInAppDeviceAction} for OS-level commands
 * that must run with no app open (e.g. the address-book Edit Contact Name
 * `E0 2E` command). The output is the result of the task.
 *
 * ```ts
 * const deviceAction = new CallTaskOnDashboardDeviceAction({
 *  input: {
 *   task: async (internalApi) => internalApi.sendCommand(new MyOsCommand()),
 *   requiredUserInteraction: UserInteractionRequired.None,
 *  },
 * });
 * dmk.executeDeviceAction({ sessionId, deviceAction });
 * ```
 */
export class CallTaskOnDashboardDeviceAction<
  TaskResponse,
  TaskError extends DmkError,
  UserInteraction extends UserInteractionRequired,
> extends XStateDeviceAction<
  CallTaskOnDashboardDAOutput<TaskResponse>,
  CallTaskOnDashboardDAInput<TaskResponse, TaskError, UserInteraction>,
  CallTaskOnDashboardDAError<TaskError>,
  CallTaskOnDashboardDAIntermediateValue<UserInteraction>,
  CallTaskOnDashboardDAInternalState<TaskResponse, TaskError>
> {
  makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    CallTaskOnDashboardDAOutput<TaskResponse>,
    CallTaskOnDashboardDAInput<TaskResponse, TaskError, UserInteraction>,
    CallTaskOnDashboardDAError<TaskError>,
    CallTaskOnDashboardDAIntermediateValue<UserInteraction>,
    CallTaskOnDashboardDAInternalState<TaskResponse, TaskError>
  > {
    type types = StateMachineTypes<
      CallTaskOnDashboardDAOutput<TaskResponse>,
      CallTaskOnDashboardDAInput<TaskResponse, TaskError, UserInteraction>,
      CallTaskOnDashboardDAError<TaskError>,
      CallTaskOnDashboardDAIntermediateValue<UserInteraction>,
      CallTaskOnDashboardDAInternalState<TaskResponse, TaskError>
    >;

    const { callTask } = this.extractDependencies(internalAPI);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        callTask: fromPromise(callTask),
        goToDashboardStateMachine: new GoToDashboardDeviceAction({
          input: {
            unlockTimeout: this.input.unlockTimeout,
          },
        }).makeStateMachine(internalAPI),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            // Safety net: `callTask` returns a DmkResult and never rejects, so
            // this onError path should be unreachable. The XState event error
            // is untyped here, hence the cast.
            error: _.event["error"] as CallTaskOnDashboardDAError<TaskError>,
          }),
        }),
      },
    }).createMachine({
      id: "CallTaskOnDashboardDeviceAction",
      initial: "GoToDashboard",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: callTaskOnDashboardDAStateStep.GO_TO_DASHBOARD,
          },
          _internalState: {
            taskResponse: null,
            error: null,
          },
        };
      },
      states: {
        GoToDashboard: {
          invoke: {
            id: "goToDashboardStateMachine",
            src: "goToDashboardStateMachine",
            input: () => ({
              unlockTimeout: this.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<
                    CallTaskOnDashboardDAInternalState<TaskResponse, TaskError>
                  >({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
              target: "CheckGoToDashboardResult",
            },
          },
        },
        CheckGoToDashboardResult: {
          always: [
            {
              target: "CallTask",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        CallTask: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: this.input.requiredUserInteraction,
              step: callTaskOnDashboardDAStateStep.CALL_TASK,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: callTaskOnDashboardDAStateStep.CALL_TASK,
            },
          }),
          invoke: {
            id: "callTask",
            src: "callTask",
            input: (_: { context: types["context"] }) => _.context.input.task,
            onDone: {
              target: "CallTaskResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessDmkResult(event.output)) {
                      return {
                        ...context._internalState,
                        taskResponse: event.output.data,
                      };
                    }
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };
                  },
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        CallTaskResultCheck: {
          always: [
            {
              target: "Success",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: ({ context }) =>
        context._internalState.taskResponse
          ? Right(context._internalState.taskResponse)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi) {
    return {
      callTask: (_: {
        input: (
          internalApi: InternalApi,
        ) => Promise<DmkResult<TaskResponse, TaskError>>;
      }): Promise<DmkResult<TaskResponse, TaskError>> => _.input(internalApi),
    };
  }
}

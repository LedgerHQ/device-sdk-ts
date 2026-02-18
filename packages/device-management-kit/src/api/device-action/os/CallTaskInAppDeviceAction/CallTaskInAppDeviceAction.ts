import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type CommandResult,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { OpenAppDeviceAction } from "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";

import {
  type CallTaskInAppDAError,
  type CallTaskInAppDAInput,
  type CallTaskInAppDAIntermediateValue,
  type CallTaskInAppDAInternalState,
  type CallTaskInAppDAOutput,
  callTaskInAppDAStateStep,
} from "./CallTaskInAppDeviceActionTypes";

/**
 * Tries to open an app on the device, and if it is successful, calls a task
 * in the app.
 * The output will be the result of the task.
 *
 * ```ts
 * input: {
 *  appName: string;
 *  task: (internalApi: InternalApi) => Promise<CommandResult<TaskResponse, TaskErrorCodes>>;
 *  requiredUserInteraction: UserInteraction;
 * }
 * ```
 *
 * Example of usage:
 *
 * ```ts
 * const deviceAction = new CallTaskInAppDeviceAction({
 *  input: {
 *   appName: "MyApp",
 *   task: async (internalApi: InternalApi) => internalApi.sendCommand(new MyAppSpecificCommand()),
 *   requiredUserInteraction: UserInteractionRequired.None,
 *  },
 * });
 * dmk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class CallTaskInAppDeviceAction<
  TaskResponse,
  TaskErrorCodes,
  UserInteraction extends UserInteractionRequired,
> extends XStateDeviceAction<
  CallTaskInAppDAOutput<TaskResponse>,
  CallTaskInAppDAInput<TaskResponse, TaskErrorCodes, UserInteraction>,
  CallTaskInAppDAError<TaskErrorCodes>,
  CallTaskInAppDAIntermediateValue<UserInteraction>,
  CallTaskInAppDAInternalState<TaskResponse, TaskErrorCodes>
> {
  makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    CallTaskInAppDAOutput<TaskResponse>,
    CallTaskInAppDAInput<TaskResponse, TaskErrorCodes, UserInteraction>,
    CallTaskInAppDAError<TaskErrorCodes>,
    CallTaskInAppDAIntermediateValue<UserInteraction>,
    CallTaskInAppDAInternalState<TaskResponse, TaskErrorCodes>
  > {
    type types = StateMachineTypes<
      CallTaskInAppDAOutput<TaskResponse>,
      CallTaskInAppDAInput<TaskResponse, TaskErrorCodes, UserInteraction>,
      CallTaskInAppDAError<TaskErrorCodes>,
      CallTaskInAppDAIntermediateValue<UserInteraction>,
      CallTaskInAppDAInternalState<TaskResponse, TaskErrorCodes>
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
        openAppStateMachine: new OpenAppDeviceAction({
          input: {
            appName: this.input.appName,
          },
        }).makeStateMachine(internalAPI),
      },
      guards: {
        skipOpenApp: () => this.input.skipOpenApp,
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      id: "CallTaskInAppDeviceAction",
      initial: "InitialState",
      context: ({ input }) => {
        return {
          input: input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: callTaskInAppDAStateStep.OPEN_APP,
          },
          _internalState: {
            taskResponse: null,
            error: null,
          },
        };
      },
      states: {
        InitialState: {
          always: [
            {
              target: "CallTask",
              guard: "skipOpenApp",
            },
            "OpenAppDeviceAction",
          ],
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            input: {
              appName: this.input.appName,
            },
            src: "openAppStateMachine",
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
                    CallTaskInAppDAInternalState<TaskResponse, TaskErrorCodes>
                  >({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
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
              step: callTaskInAppDAStateStep.CALL_TASK,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: callTaskInAppDAStateStep.CALL_TASK,
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
                    if (isSuccessCommandResult(event.output)) {
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
        ) => Promise<CommandResult<TaskResponse, TaskErrorCodes>>;
      }): Promise<CommandResult<TaskResponse, TaskErrorCodes>> =>
        _.input(internalApi),
    };
  }
}

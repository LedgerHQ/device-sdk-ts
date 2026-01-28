import {
  DEFAULT_UNLOCK_TIMEOUT_MS,
  type DeviceActionStateMachine,
  GoToDashboardDeviceAction,
  type InternalApi,
  isSuccessCommandResult,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  DeleteBackgroundImageCommand,
  type DeleteBackgroundImageCommandResult,
} from "@api/command/DeleteBackgroundImageCommand";
import { mapRemoveCommandError } from "@api/device-action/customLockScreenDeviceActionErrors";

import type {
  RemoveCustomLockScreenDAError,
  RemoveCustomLockScreenDAInput,
  RemoveCustomLockScreenDAIntermediateValue,
  RemoveCustomLockScreenDAOutput,
} from "./types";

type RemoveCustomLockScreenMachineInternalState = {
  readonly error: RemoveCustomLockScreenDAError | null;
};

export type MachineDependencies = {
  readonly deleteBackgroundImage: () => Promise<DeleteBackgroundImageCommandResult>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

/**
 * Device action to remove the custom lock screen image from the device.
 *
 * This action:
 * 1. Ensures the device is on the dashboard
 * 2. Sends the remove command (user approval required)
 *
 * @example
 * ```ts
 * const deviceAction = new RemoveCustomLockScreenDeviceAction({
 *   input: {},
 * });
 * dmk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class RemoveCustomLockScreenDeviceAction extends XStateDeviceAction<
  RemoveCustomLockScreenDAOutput,
  RemoveCustomLockScreenDAInput,
  RemoveCustomLockScreenDAError,
  RemoveCustomLockScreenDAIntermediateValue,
  RemoveCustomLockScreenMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    RemoveCustomLockScreenDAOutput,
    RemoveCustomLockScreenDAInput,
    RemoveCustomLockScreenDAError,
    RemoveCustomLockScreenDAIntermediateValue,
    RemoveCustomLockScreenMachineInternalState
  > {
    type types = StateMachineTypes<
      RemoveCustomLockScreenDAOutput,
      RemoveCustomLockScreenDAInput,
      RemoveCustomLockScreenDAError,
      RemoveCustomLockScreenDAIntermediateValue,
      RemoveCustomLockScreenMachineInternalState
    >;

    const { deleteBackgroundImage } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const goToDashboardMachine = new GoToDashboardDeviceAction({
      input: { unlockTimeout },
    }).makeStateMachine(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        goToDashboard: goToDashboardMachine,
        deleteBackgroundImage: fromPromise(deleteBackgroundImage),
      },
      guards: {
        hasError: ({ context }) => context._internalState.error !== null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
      },
    }).createMachine({
      id: "RemoveCustomLockScreenDeviceAction",
      initial: "DeviceReady",
      context: (_) => ({
        input: _.input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
        },
      }),
      states: {
        DeviceReady: {
          always: { target: "GoToDashboard" },
        },

        GoToDashboard: {
          invoke: {
            id: "dashboard",
            src: "goToDashboard",
            input: (_) => ({ unlockTimeout: _.context.input.unlockTimeout }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "GoToDashboardCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RemoveCustomLockScreenMachineInternalState>(
                    {
                      Right: () => _.context._internalState,
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  );
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },

        GoToDashboardCheck: {
          always: [
            { target: "Error", guard: "hasError" },
            { target: "RemoveImage" },
          ],
        },

        RemoveImage: {
          entry: assign({
            intermediateValue: (_) => ({
              requiredUserInteraction:
                UserInteractionRequired.ConfirmRemoveImage,
            }),
          }),
          exit: assign({
            intermediateValue: (_) => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "deleteBackgroundImage",
            onDone: {
              target: "RemoveImageCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return _.context._internalState;
                  }
                  return {
                    ..._.context._internalState,
                    error: mapRemoveCommandError(_.event.output.error),
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },

        RemoveImageCheck: {
          always: [
            { target: "Error", guard: "hasError" },
            { target: "Success" },
          ],
        },

        Success: { type: "final" },
        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.error
          ? Left(context._internalState.error)
          : Right(undefined),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      deleteBackgroundImage: async () =>
        internalApi.sendCommand(new DeleteBackgroundImageCommand()),
    };
  }
}

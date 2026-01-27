import {
  DEFAULT_UNLOCK_TIMEOUT_MS,
  type DeviceActionStateMachine,
  GetBackgroundImageSizeCommand,
  type GetBackgroundImageSizeCommandResult,
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
  BackgroundImageCommandError,
  CLS_ERROR_NO_BACKGROUND_IMAGE,
} from "@api/command/BackgroundImageCommandErrors";
import {
  GetBackgroundImageHashCommand,
  type GetBackgroundImageHashCommandResult,
} from "@api/command/GetBackgroundImageHashCommand";
import { mapDownloadCommandError } from "@api/device-action/customLockScreenDeviceActionErrors";

import type {
  GetCustomLockScreenInfoDAError,
  GetCustomLockScreenInfoDAInput,
  GetCustomLockScreenInfoDAIntermediateValue,
  GetCustomLockScreenInfoDAOutput,
} from "./types";

type GetCustomLockScreenInfoMachineInternalState = {
  readonly error: GetCustomLockScreenInfoDAError | null;
  readonly imageSize: number | null;
  readonly imageHash: string | null;
  readonly noImageOnDevice: boolean;
};

export type MachineDependencies = {
  readonly getBackgroundImageSize: () => Promise<GetBackgroundImageSizeCommandResult>;
  readonly getBackgroundImageHash: () => Promise<GetBackgroundImageHashCommandResult>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

/**
 * Device action to get information about the custom lock screen on the device.
 *
 * This action:
 * 1. Ensures the device is on the dashboard
 * 2. Fetches the image size (if no image, returns NoCustomLockScreen)
 * 3. Fetches the image hash
 * 4. Returns the size and hash if an image exists
 *
 * @example
 * ```ts
 * const deviceAction = new GetCustomLockScreenInfoDeviceAction({
 *   input: {},
 * });
 * dmk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class GetCustomLockScreenInfoDeviceAction extends XStateDeviceAction<
  GetCustomLockScreenInfoDAOutput,
  GetCustomLockScreenInfoDAInput,
  GetCustomLockScreenInfoDAError,
  GetCustomLockScreenInfoDAIntermediateValue,
  GetCustomLockScreenInfoMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GetCustomLockScreenInfoDAOutput,
    GetCustomLockScreenInfoDAInput,
    GetCustomLockScreenInfoDAError,
    GetCustomLockScreenInfoDAIntermediateValue,
    GetCustomLockScreenInfoMachineInternalState
  > {
    type types = StateMachineTypes<
      GetCustomLockScreenInfoDAOutput,
      GetCustomLockScreenInfoDAInput,
      GetCustomLockScreenInfoDAError,
      GetCustomLockScreenInfoDAIntermediateValue,
      GetCustomLockScreenInfoMachineInternalState
    >;

    const { getBackgroundImageSize, getBackgroundImageHash } =
      this.extractDependencies(internalApi);

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
        getBackgroundImageSize: fromPromise(getBackgroundImageSize),
        getBackgroundImageHash: fromPromise(getBackgroundImageHash),
      },
      guards: {
        hasError: ({ context }) => context._internalState.error !== null,
        noImageOnDevice: ({ context }) =>
          context._internalState.noImageOnDevice,
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
      id: "GetCustomLockScreenInfoDeviceAction",
      initial: "DeviceReady",
      context: (_) => ({
        input: _.input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          imageSize: null,
          imageHash: null,
          noImageOnDevice: false,
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
                  return _.event.output.caseOf<GetCustomLockScreenInfoMachineInternalState>(
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
            { target: "GetImageSize" },
          ],
        },

        GetImageSize: {
          invoke: {
            src: "getBackgroundImageSize",
            onDone: {
              target: "GetImageSizeCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    const imageSize = _.event.output.data;
                    // Per spec: GetSize returns success with 0 when no image on device
                    if (imageSize === 0) {
                      return {
                        ..._.context._internalState,
                        noImageOnDevice: true,
                      };
                    }
                    return {
                      ..._.context._internalState,
                      imageSize,
                    };
                  }
                  // Fallback: handle 662e error code (in case of older firmware)
                  const commandError = _.event.output.error;
                  if (
                    commandError instanceof BackgroundImageCommandError &&
                    commandError.errorCode === CLS_ERROR_NO_BACKGROUND_IMAGE
                  ) {
                    return {
                      ..._.context._internalState,
                      noImageOnDevice: true,
                    };
                  }
                  // Map other command errors to DA error
                  return {
                    ..._.context._internalState,
                    error: mapDownloadCommandError(commandError),
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

        GetImageSizeCheck: {
          always: [
            { target: "Error", guard: "hasError" },
            { target: "Success", guard: "noImageOnDevice" },
            { target: "GetImageHash" },
          ],
        },

        GetImageHash: {
          invoke: {
            src: "getBackgroundImageHash",
            onDone: {
              target: "GetImageHashCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      imageHash: _.event.output.data.hash,
                    };
                  }
                  // Safeguard: handle 662e error as "no image" (edge case / race condition)
                  const commandError = _.event.output.error;
                  if (
                    commandError instanceof BackgroundImageCommandError &&
                    commandError.errorCode === CLS_ERROR_NO_BACKGROUND_IMAGE
                  ) {
                    return {
                      ..._.context._internalState,
                      noImageOnDevice: true,
                    };
                  }
                  // Map other command errors to DA error
                  return {
                    ..._.context._internalState,
                    error: mapDownloadCommandError(commandError),
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

        GetImageHashCheck: {
          always: [
            { target: "Error", guard: "hasError" },
            { target: "Success" },
          ],
        },

        Success: { type: "final" },
        Error: { type: "final" },
      },

      output: ({ context }) => {
        if (context._internalState.error) {
          return Left(context._internalState.error);
        }
        if (context._internalState.noImageOnDevice) {
          return Right({ hasCustomLockScreen: false as const });
        }
        return Right({
          hasCustomLockScreen: true as const,
          sizeBytes: context._internalState.imageSize!,
          hash: context._internalState.imageHash!,
        });
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      getBackgroundImageSize: async () =>
        internalApi.sendCommand(new GetBackgroundImageSizeCommand()),
      getBackgroundImageHash: async () =>
        internalApi.sendCommand(new GetBackgroundImageHashCommand()),
    };
  }
}

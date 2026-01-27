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
  FetchBackgroundImageChunkCommand,
  type FetchBackgroundImageChunkCommandResult,
} from "@api/command/FetchBackgroundImageChunkCommand";
import {
  GetBackgroundImageHashCommand,
  type GetBackgroundImageHashCommandResult,
} from "@api/command/GetBackgroundImageHashCommand";
import {
  mapDownloadCommandError,
  NoCustomLockScreenImageDAError,
} from "@api/device-action/customLockScreenDeviceActionErrors";
import { getNextDownloadChunkLength } from "@api/device-action/utils/chunkUtils";

import type {
  DownloadCustomLockScreenDAError,
  DownloadCustomLockScreenDAInput,
  DownloadCustomLockScreenDAIntermediateValue,
  DownloadCustomLockScreenDAOutput,
} from "./types";

type DownloadCustomLockScreenMachineInternalState = {
  readonly error: DownloadCustomLockScreenDAError | null;
  readonly imageHash: string | null;
  readonly imageSize: number | null;
  readonly currentOffset: number;
  readonly imageData: Uint8Array;
  readonly alreadyBackedUp: boolean;
  readonly noImageOnDevice: boolean;
};

export type MachineDependencies = {
  readonly getBackgroundImageHash: () => Promise<GetBackgroundImageHashCommandResult>;
  readonly getBackgroundImageSize: () => Promise<GetBackgroundImageSizeCommandResult>;
  readonly fetchBackgroundImageChunk: (arg0: {
    input: { offset: number; length: number };
  }) => Promise<FetchBackgroundImageChunkCommandResult>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

/**
 * Device action to fetch the custom lock screen image from the device.
 *
 * This action:
 * 1. Ensures the device is on the dashboard
 * 2. Fetches the image hash (for early comparison)
 * 3. If backupHash matches, returns early with alreadyBackedUp
 * 4. If no image and allowedEmpty, completes successfully
 * 5. Fetches the image size
 * 6. Fetches the image data in chunks
 *
 * @example
 * ```ts
 * const deviceAction = new DownloadCustomLockScreenDeviceAction({
 *   input: {
 *     backupHash: "abc123", // optional
 *     allowedEmpty: true,   // optional
 *   },
 * });
 * dmk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class DownloadCustomLockScreenDeviceAction extends XStateDeviceAction<
  DownloadCustomLockScreenDAOutput,
  DownloadCustomLockScreenDAInput,
  DownloadCustomLockScreenDAError,
  DownloadCustomLockScreenDAIntermediateValue,
  DownloadCustomLockScreenMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    DownloadCustomLockScreenDAOutput,
    DownloadCustomLockScreenDAInput,
    DownloadCustomLockScreenDAError,
    DownloadCustomLockScreenDAIntermediateValue,
    DownloadCustomLockScreenMachineInternalState
  > {
    type types = StateMachineTypes<
      DownloadCustomLockScreenDAOutput,
      DownloadCustomLockScreenDAInput,
      DownloadCustomLockScreenDAError,
      DownloadCustomLockScreenDAIntermediateValue,
      DownloadCustomLockScreenMachineInternalState
    >;

    const {
      getBackgroundImageHash,
      getBackgroundImageSize,
      fetchBackgroundImageChunk,
    } = this.extractDependencies(internalApi);

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
        getBackgroundImageHash: fromPromise(getBackgroundImageHash),
        getBackgroundImageSize: fromPromise(getBackgroundImageSize),
        fetchBackgroundImageChunk: fromPromise(fetchBackgroundImageChunk),
      },
      guards: {
        hasError: ({ context }) => context._internalState.error !== null,
        isAlreadyBackedUp: ({ context }) =>
          context._internalState.alreadyBackedUp,
        isImageEmpty: ({ context }) => context._internalState.noImageOnDevice,
        isImageEmptyAndAllowed: ({ context }) =>
          context._internalState.noImageOnDevice &&
          Boolean(context.input.allowedEmpty),
        isImageSizeZero: ({ context }) =>
          context._internalState.imageSize === 0,
        isImageSizeZeroAndAllowed: ({ context }) =>
          context._internalState.imageSize === 0 &&
          Boolean(context.input.allowedEmpty),
        allChunksFetched: ({ context }) => {
          const { currentOffset, imageSize } = context._internalState;
          return imageSize !== null && currentOffset >= imageSize;
        },
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
        assignNoImageError: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new NoCustomLockScreenImageDAError(),
          }),
        }),
      },
    }).createMachine({
      id: "DownloadCustomLockScreenDeviceAction",
      initial: "DeviceReady",
      context: (_) => ({
        input: _.input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          imageHash: null,
          imageSize: null,
          currentOffset: 0,
          imageData: new Uint8Array(0),
          alreadyBackedUp: false,
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
                  return _.event.output.caseOf<DownloadCustomLockScreenMachineInternalState>(
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
                    const currentHash = _.event.output.data.hash;
                    const backupHash = _.context.input.backupHash;
                    const alreadyBackedUp =
                      backupHash !== undefined && currentHash === backupHash;
                    return {
                      ..._.context._internalState,
                      imageHash: currentHash,
                      alreadyBackedUp,
                    };
                  }
                  // Check if error is "no image on device"
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
                  // Map command error to DA error
                  return {
                    ..._.context._internalState,
                    error: mapDownloadCommandError(commandError),
                  };
                },
                intermediateValue: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context.intermediateValue,
                      currentImageHash: _.event.output.data.hash,
                    };
                  }
                  return _.context.intermediateValue;
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
            { target: "Success", guard: "isAlreadyBackedUp" },
            { target: "Success", guard: "isImageEmptyAndAllowed" },
            {
              target: "Error",
              guard: "isImageEmpty",
              actions: "assignNoImageError",
            },
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
                    return {
                      ..._.context._internalState,
                      imageSize: _.event.output.data,
                      imageData: new Uint8Array(_.event.output.data),
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: mapDownloadCommandError(_.event.output.error),
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
            { target: "Success", guard: "isImageSizeZeroAndAllowed" },
            {
              target: "Error",
              guard: "isImageSizeZero",
              actions: "assignNoImageError",
            },
            { target: "FetchChunk" },
          ],
        },

        FetchChunk: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
              progress:
                _.context._internalState.imageSize !== null &&
                _.context._internalState.imageSize > 0
                  ? _.context._internalState.currentOffset /
                    _.context._internalState.imageSize
                  : 0,
            }),
          }),
          invoke: {
            src: "fetchBackgroundImageChunk",
            input: (_) => {
              const { currentOffset, imageSize } = _.context._internalState;
              const length = getNextDownloadChunkLength(
                currentOffset,
                imageSize ?? 0,
              );
              return { offset: currentOffset, length };
            },
            onDone: {
              target: "FetchChunkCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    const { currentOffset, imageData } =
                      _.context._internalState;
                    const chunkData = _.event.output.data.data;
                    // Mutate buffer in place (pre-allocated to full size)
                    imageData.set(chunkData, currentOffset);
                    return {
                      ..._.context._internalState,
                      currentOffset: currentOffset + chunkData.length,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: mapDownloadCommandError(_.event.output.error),
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

        FetchChunkCheck: {
          always: [
            { target: "Error", guard: "hasError" },
            { target: "Success", guard: "allChunksFetched" },
            { target: "FetchChunk" },
          ],
        },

        Success: { type: "final" },
        Error: { type: "final" },
      },

      output: ({ context }) => {
        if (context._internalState.error) {
          return Left(context._internalState.error);
        }
        if (context._internalState.alreadyBackedUp) {
          return Right({ alreadyBackedUp: true as const });
        }
        return Right({
          imageData: context._internalState.imageData,
          imageHash: context._internalState.imageHash ?? "",
        });
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      getBackgroundImageHash: async () =>
        internalApi.sendCommand(new GetBackgroundImageHashCommand()),
      getBackgroundImageSize: async () =>
        internalApi.sendCommand(new GetBackgroundImageSizeCommand()),
      fetchBackgroundImageChunk: async (arg0) =>
        internalApi.sendCommand(
          new FetchBackgroundImageChunkCommand({
            offset: arg0.input.offset,
            length: arg0.input.length,
          }),
        ),
    };
  }
}

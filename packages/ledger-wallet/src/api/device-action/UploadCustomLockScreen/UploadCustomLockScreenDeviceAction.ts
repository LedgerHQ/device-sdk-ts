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
  CommitBackgroundImageCommand,
  type CommitBackgroundImageCommandResult,
} from "@api/command/CommitBackgroundImageCommand";
import {
  CreateBackgroundImageCommand,
  type CreateBackgroundImageCommandResult,
} from "@api/command/CreateBackgroundImageCommand";
import {
  GetBackgroundImageHashCommand,
  type GetBackgroundImageHashCommandResult,
} from "@api/command/GetBackgroundImageHashCommand";
import {
  UploadBackgroundImageChunkCommand,
  type UploadBackgroundImageChunkCommandResult,
} from "@api/command/UploadBackgroundImageChunkCommand";
import {
  InvalidCustomLockScreenImageDataDAError,
  mapUploadCommandError,
} from "@api/device-action/customLockScreenDeviceActionErrors";
import {
  splitIntoUploadChunks,
  type UploadChunk,
} from "@api/device-action/utils/chunkUtils";

import type {
  UploadCustomLockScreenDAError,
  UploadCustomLockScreenDAInput,
  UploadCustomLockScreenDAIntermediateValue,
  UploadCustomLockScreenDAOutput,
} from "./types";

type UploadCustomLockScreenMachineInternalState = {
  readonly error: UploadCustomLockScreenDAError | null;
  readonly chunks: UploadChunk[];
  readonly currentChunkIndex: number;
  readonly imageSize: number;
  readonly imageHash: string | null;
  readonly imageSizeResult: number | null;
};

export type MachineDependencies = {
  readonly createBackgroundImage: (arg0: {
    input: { imageSize: number };
  }) => Promise<CreateBackgroundImageCommandResult>;
  readonly uploadBackgroundImageChunk: (arg0: {
    input: { offset: number; data: Uint8Array };
  }) => Promise<UploadBackgroundImageChunkCommandResult>;
  readonly commitBackgroundImage: () => Promise<CommitBackgroundImageCommandResult>;
  readonly getBackgroundImageSize: () => Promise<GetBackgroundImageSizeCommandResult>;
  readonly getBackgroundImageHash: () => Promise<GetBackgroundImageHashCommandResult>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

/**
 * Device action to upload a custom lock screen image onto the device.
 *
 * This action:
 * 1. Ensures the device is on the dashboard
 * 2. Creates a custom image slot (user approval required)
 * 3. Uploads the image data in chunks
 * 4. Commits the image (user approval required)
 * 5. Verifies the result by fetching the size and hash
 *
 * @example
 * ```ts
 * const deviceAction = new UploadCustomLockScreenDeviceAction({
 *   input: {
 *     imageData: myImageData,
 *   },
 * });
 * dmk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class UploadCustomLockScreenDeviceAction extends XStateDeviceAction<
  UploadCustomLockScreenDAOutput,
  UploadCustomLockScreenDAInput,
  UploadCustomLockScreenDAError,
  UploadCustomLockScreenDAIntermediateValue,
  UploadCustomLockScreenMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    UploadCustomLockScreenDAOutput,
    UploadCustomLockScreenDAInput,
    UploadCustomLockScreenDAError,
    UploadCustomLockScreenDAIntermediateValue,
    UploadCustomLockScreenMachineInternalState
  > {
    type types = StateMachineTypes<
      UploadCustomLockScreenDAOutput,
      UploadCustomLockScreenDAInput,
      UploadCustomLockScreenDAError,
      UploadCustomLockScreenDAIntermediateValue,
      UploadCustomLockScreenMachineInternalState
    >;

    const {
      createBackgroundImage,
      uploadBackgroundImageChunk,
      commitBackgroundImage,
      getBackgroundImageSize,
      getBackgroundImageHash,
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
        createBackgroundImage: fromPromise(createBackgroundImage),
        uploadBackgroundImageChunk: fromPromise(uploadBackgroundImageChunk),
        commitBackgroundImage: fromPromise(commitBackgroundImage),
        getBackgroundImageSize: fromPromise(getBackgroundImageSize),
        getBackgroundImageHash: fromPromise(getBackgroundImageHash),
      },
      guards: {
        hasError: ({ context }) => context._internalState.error !== null,
        isImageDataEmpty: ({ context }) => context.input.imageData.length === 0,
        allChunksUploaded: ({ context }) =>
          context._internalState.currentChunkIndex >=
          context._internalState.chunks.length,
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
      id: "UploadCustomLockScreenDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        const chunks = splitIntoUploadChunks(_.input.imageData);
        return {
          input: _.input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            chunks,
            currentChunkIndex: 0,
            imageSize: _.input.imageData.length,
            imageHash: null,
            imageSizeResult: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: [
            {
              target: "Error",
              guard: "isImageDataEmpty",
              actions: assign({
                _internalState: ({ context }) => ({
                  ...context._internalState,
                  error: new InvalidCustomLockScreenImageDataDAError(
                    "Image data is empty",
                  ),
                }),
              }),
            },
            { target: "GoToDashboard" },
          ],
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
                  return _.event.output.caseOf<UploadCustomLockScreenMachineInternalState>(
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
            { target: "CreateImage" },
          ],
        },

        CreateImage: {
          entry: assign({
            intermediateValue: (_) => ({
              requiredUserInteraction: UserInteractionRequired.ConfirmLoadImage,
            }),
          }),
          exit: assign({
            intermediateValue: (_) => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "createBackgroundImage",
            input: (_) => ({
              imageSize: _.context._internalState.imageSize,
            }),
            onDone: {
              target: "CreateImageCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return _.context._internalState;
                  }
                  return {
                    ..._.context._internalState,
                    error: mapUploadCommandError(_.event.output.error),
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

        CreateImageCheck: {
          always: [
            { target: "Error", guard: "hasError" },
            { target: "UploadChunk" },
          ],
        },

        UploadChunk: {
          entry: assign({
            intermediateValue: (_) => ({
              requiredUserInteraction: UserInteractionRequired.None,
              progress:
                _.context._internalState.currentChunkIndex /
                _.context._internalState.chunks.length,
            }),
          }),
          invoke: {
            src: "uploadBackgroundImageChunk",
            input: (_) =>
              _.context._internalState.chunks[
                _.context._internalState.currentChunkIndex
              ]!,
            onDone: {
              target: "UploadChunkCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      currentChunkIndex:
                        _.context._internalState.currentChunkIndex + 1,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: mapUploadCommandError(_.event.output.error),
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

        UploadChunkCheck: {
          always: [
            { target: "Error", guard: "hasError" },
            { target: "CommitImage", guard: "allChunksUploaded" },
            { target: "UploadChunk" },
          ],
        },

        CommitImage: {
          entry: assign({
            intermediateValue: (_) => ({
              requiredUserInteraction:
                UserInteractionRequired.ConfirmCommitImage,
              progress: 1,
            }),
          }),
          exit: assign({
            intermediateValue: (_) => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "commitBackgroundImage",
            onDone: {
              target: "CommitImageCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return _.context._internalState;
                  }
                  return {
                    ..._.context._internalState,
                    error: mapUploadCommandError(_.event.output.error),
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

        CommitImageCheck: {
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
                    return {
                      ..._.context._internalState,
                      imageSizeResult: _.event.output.data,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: mapUploadCommandError(_.event.output.error),
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
                  return {
                    ..._.context._internalState,
                    error: mapUploadCommandError(_.event.output.error),
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

      output: ({ context }) =>
        context._internalState.error
          ? Left(context._internalState.error)
          : Right({
              imageHash: context._internalState.imageHash!,
              imageSize: context._internalState.imageSizeResult!,
            }),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      createBackgroundImage: async (arg0) =>
        internalApi.sendCommand(
          new CreateBackgroundImageCommand({ imageSize: arg0.input.imageSize }),
        ),
      uploadBackgroundImageChunk: async (arg0) =>
        internalApi.sendCommand(
          new UploadBackgroundImageChunkCommand({
            offset: arg0.input.offset,
            data: arg0.input.data,
          }),
        ),
      commitBackgroundImage: async () =>
        internalApi.sendCommand(new CommitBackgroundImageCommand()),
      getBackgroundImageSize: async () =>
        internalApi.sendCommand(new GetBackgroundImageSizeCommand()),
      getBackgroundImageHash: async () =>
        internalApi.sendCommand(new GetBackgroundImageHashCommand()),
    };
  }
}

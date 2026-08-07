import {
  type DeviceActionStateMachine,
  type InternalApi,
  SecureChannelEventType,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { getOsVersion } from "@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion";

import { flashMcu } from "./Substeps/FlashMcu";
import { resolveMcuVersion } from "./Substeps/ResolveMcuVersion";
import { BootloaderModeTimeoutError } from "./FlashMcuDeviceActionErrors";
import {
  type FlashMcuDAError,
  type FlashMcuDAInput,
  type FlashMcuDAIntermediateValue,
  type FlashMcuDAInternalState,
  FlashMcuSteps,
} from "./types";

/*
 * The device reboots into the bootloader on its own, so it can still answer as
 * the running OS for a short while. Poll a bounded number of times rather than
 * assuming it presents as a bootloader straight away.
 */
const MAX_BOOTLOADER_POLL_ATTEMPTS = 10;
const BOOTLOADER_POLL_INTERVAL_MS = 2000;

export class FlashMcuDeviceAction extends XStateDeviceAction<
  void,
  FlashMcuDAInput,
  FlashMcuDAError,
  FlashMcuDAIntermediateValue,
  FlashMcuDAInternalState
> {
  protected override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    void,
    FlashMcuDAInput,
    FlashMcuDAError,
    FlashMcuDAIntermediateValue,
    FlashMcuDAInternalState
  > {
    type types = StateMachineTypes<
      void,
      FlashMcuDAInput,
      FlashMcuDAError,
      FlashMcuDAIntermediateValue,
      FlashMcuDAInternalState
    >;

    return setup({
      types: {
        input: {} as types["input"],
        output: {} as types["output"],
        context: {} as types["context"],
      } as types,
      actors: {
        getDeviceInfo: fromPromise(getOsVersion(internalApi)),
        resolveMcuVersion: fromPromise(resolveMcuVersion(internalApi)),
        flashMcu: fromObservable(flashMcu(internalApi)),
      },
      delays: {
        bootloaderPollInterval: BOOTLOADER_POLL_INTERVAL_MS,
      },
      guards: {
        isDeviceInBootloaderMode: ({ context }) =>
          context._internalState.deviceInfo?.isBootloader === true,
        hasReachedMaxAttempts: ({ context }) =>
          context._internalState.bootloaderPollAttempts >=
          MAX_BOOTLOADER_POLL_ATTEMPTS,
        hasError: ({ context }) => context._internalState.error !== null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: should never happen
          }),
        }),
      },
    }).createMachine({
      id: "FlashMcuDeviceAction",
      initial: "GetDeviceInfo",
      context: ({ input }) => ({
        input: {
          finalFirmware: input.finalFirmware,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: FlashMcuSteps.Idle,
        },
        _internalState: {
          error: null,
          deviceInfo: null,
          version: null,
          bootloaderPollAttempts: 0,
        },
      }),
      states: {
        GetDeviceInfo: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: FlashMcuSteps.GetDeviceInfo,
            }),
            _internalState: (_) => ({
              ..._.context._internalState,
              bootloaderPollAttempts:
                _.context._internalState.bootloaderPollAttempts + 1,
            }),
          }),
          invoke: {
            src: "getDeviceInfo",
            onDone: {
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<FlashMcuDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (getOsVersionResponse) => ({
                      ..._.context._internalState,
                      deviceInfo: getOsVersionResponse,
                    }),
                  }),
              }),
              target: "CheckGetDeviceInfo",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckGetDeviceInfo: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isDeviceInBootloaderMode",
              target: "ResolveMcuVersion",
            },
            {
              guard: "hasReachedMaxAttempts",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  error: new BootloaderModeTimeoutError(
                    `Device did not enter bootloader mode after ${MAX_BOOTLOADER_POLL_ATTEMPTS} attempts`,
                  ),
                }),
              }),
              target: "Error",
            },
            {
              target: "WaitForBootloaderMode",
            },
          ],
        },
        WaitForBootloaderMode: {
          after: {
            bootloaderPollInterval: {
              target: "GetDeviceInfo",
            },
          },
        },
        ResolveMcuVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: FlashMcuSteps.ResolveMcuVersion,
            }),
          }),
          invoke: {
            src: "resolveMcuVersion",
            input: ({ context }) => ({
              deviceInfo: context._internalState.deviceInfo!,
              finalFirmware: context.input.finalFirmware,
            }),
            onDone: {
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<FlashMcuDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (version) => ({
                      ..._.context._internalState,
                      version,
                    }),
                  }),
              }),
              target: "CheckResolveMcuVersion",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckResolveMcuVersion: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "FlashMcuOrBootloader",
            },
          ],
        },
        FlashMcuOrBootloader: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: FlashMcuSteps.FlashMcuOrBootloader,
            }),
          }),
          invoke: {
            src: "flashMcu",
            input: ({ context }) => ({
              deviceInfo: context._internalState.deviceInfo!,
              version: context._internalState.version!,
            }),
            onSnapshot: {
              actions: assign({
                // Flashing the MCU needs no device confirmation, so the bulk
                // exchange only reports progress here.
                intermediateValue: (_) =>
                  _.event.snapshot.context?.type ===
                  SecureChannelEventType.Progress
                    ? {
                        ..._.context.intermediateValue,
                        progress: _.event.snapshot.context.payload.progress,
                      }
                    : { ..._.context.intermediateValue },
                _internalState: (_) => {
                  if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Error
                  ) {
                    return {
                      ..._.context._internalState,
                      error:
                        _.event.snapshot.context.error.mapFlashMcuDAErrors(),
                    };
                  }
                  return _.context._internalState;
                },
              }),
            },
            onDone: {
              target: "CheckFlashMcu",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckFlashMcu: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "Success",
            },
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
        context._internalState.error !== null
          ? Left(context._internalState.error)
          : Right(undefined),
    });
  }
}

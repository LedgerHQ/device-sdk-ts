import { Left, Right } from "purify-ts";
import { first, from, interval, map, type Observable, switchMap } from "rxjs";
import { timeout } from "rxjs/operators";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetAppAndVersionCommand,
  type GetAppAndVersionCommandResult,
} from "@api/command/os/GetAppAndVersionCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { DeviceLockedError } from "@api/device-action/os/Errors";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import { LEDGER_OS_NAME } from "@api/utils/AppName";

import {
  type WaitForAppAndVersionDAError,
  type WaitForAppAndVersionDAInput,
  type WaitForAppAndVersionDAIntermediateValue,
  type WaitForAppAndVersionDAOutput,
  waitForAppAndVersionDAStateStep,
} from "./types";

type WaitForAppAndVersionMachineInternalState = {
  readonly appAndVersion: WaitForAppAndVersionDAOutput | null;
  readonly locked: boolean;
  readonly error: WaitForAppAndVersionDAError | null;
};

export type MachineDependencies = {
  readonly getAppAndVersion: () => Promise<GetAppAndVersionCommandResult>;
  readonly waitForDeviceUnlock: (args: {
    input: { unlockTimeout: number };
  }) => Observable<void>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

const isLocked = (output: GetAppAndVersionCommandResult): boolean =>
  !isSuccessCommandResult(output) &&
  "errorCode" in output.error &&
  output.error.errorCode === "5515";

const isClaNotSupported = (output: GetAppAndVersionCommandResult): boolean =>
  !isSuccessCommandResult(output) &&
  "errorCode" in output.error &&
  output.error.errorCode === "6e00";

export class WaitForAppAndVersionDeviceAction extends XStateDeviceAction<
  WaitForAppAndVersionDAOutput,
  WaitForAppAndVersionDAInput,
  WaitForAppAndVersionDAError,
  WaitForAppAndVersionDAIntermediateValue,
  WaitForAppAndVersionMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    WaitForAppAndVersionDAOutput,
    WaitForAppAndVersionDAInput,
    WaitForAppAndVersionDAError,
    WaitForAppAndVersionDAIntermediateValue,
    WaitForAppAndVersionMachineInternalState
  > {
    type types = StateMachineTypes<
      WaitForAppAndVersionDAOutput,
      WaitForAppAndVersionDAInput,
      WaitForAppAndVersionDAError,
      WaitForAppAndVersionDAIntermediateValue,
      WaitForAppAndVersionMachineInternalState
    >;

    const { getAppAndVersion, waitForDeviceUnlock } =
      this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    return setup({
      types: {
        input: {
          unlockTimeout,
        } as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        getAppAndVersion: fromPromise(getAppAndVersion),
        waitForDeviceUnlock: fromObservable(waitForDeviceUnlock),
      },
      guards: {
        isDeviceLocked: ({ context }) => context._internalState.locked,
        hasError: ({ context }) => context._internalState.error !== null,
      },
      actions: {
        assignErrorDeviceLocked: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new DeviceLockedError(),
          }),
        }),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      id: "WaitForAppAndVersionDeviceAction",
      initial: "GetAppAndVersion",
      context: (_) => ({
        input: {
          unlockTimeout: _.input.unlockTimeout,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: waitForAppAndVersionDAStateStep.GET_APP_AND_VERSION,
        },
        _internalState: {
          appAndVersion: null,
          locked: false,
          error: null,
        },
      }),
      states: {
        GetAppAndVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: waitForAppAndVersionDAStateStep.GET_APP_AND_VERSION,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "getAppAndVersion",
            onDone: {
              target: "CheckGetAppAndVersionResult",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      locked: false,
                      appAndVersion: _.event.output.data,
                    };
                  }
                  if (isLocked(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      locked: true,
                    };
                  }
                  if (isClaNotSupported(_.event.output)) {
                    // GetAppAndVersion should always be supported by the firmware or any app.
                    // But on old firmware versions, that APDU was not supported in the dashboard.
                    // On those firmwares, it fails with CLA_NOT_SUPPORTED in BOLOS, and INS_NOT_SUPPORTED
                    // in applications. Therefore if CLA is not supported, we can consider we're on the
                    // dashboard on an old firmware. We should therefore return that information to
                    // ensure the user can still update his firmware and is not blocked at this step.
                    return {
                      ..._.context._internalState,
                      locked: false,
                      appAndVersion: {
                        name: LEDGER_OS_NAME,
                        version: "0.0.0",
                      },
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: _.event.output.error,
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
        CheckGetAppAndVersionResult: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isDeviceLocked",
              target: "AwaitingForDeviceUnlocked",
            },
            {
              target: "Success",
            },
          ],
        },
        AwaitingForDeviceUnlocked: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.UnlockDevice,
              step: waitForAppAndVersionDAStateStep.UNLOCK_DEVICE,
            }),
          }),
          invoke: {
            id: "AwaitingForDeviceUnlocked",
            src: "waitForDeviceUnlock",
            input: (_) => ({
              unlockTimeout,
            }),
            onDone: {
              target: "GetAppAndVersion",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  locked: false,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorDeviceLocked",
            },
          },
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: (args) => {
        const { context } = args;
        const { error, appAndVersion } = context._internalState;
        if (error) {
          return Left(error);
        }
        return Right<WaitForAppAndVersionDAOutput>(appAndVersion!);
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getAppAndVersion = () =>
      internalApi.sendCommand(new GetAppAndVersionCommand());

    const waitForDeviceUnlock = ({
      input,
    }: {
      input: { unlockTimeout: number };
    }) =>
      interval(1000).pipe(
        switchMap(() =>
          from(internalApi.sendCommand(new GetAppAndVersionCommand())),
        ),
        first((output) => !isLocked(output)),
        map(() => undefined),
        timeout(input.unlockTimeout),
      );

    return {
      getAppAndVersion,
      waitForDeviceUnlock,
    };
  }
}

import { Left, Right } from "purify-ts";
import { Observable } from "rxjs";
import { tap, timeout } from "rxjs/operators";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetAppAndVersionCommand,
  type GetAppAndVersionCommandResult,
} from "@api/command/os/GetAppAndVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
} from "@api/device-action/os/Errors";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";

import {
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDAIntermediateValue,
  type GetDeviceStatusDAOutput,
} from "./types";

type GetDeviceStatusMachineInternalState = {
  readonly onboarded: boolean;
  readonly locked: boolean;
  readonly currentApp: string | null;
  readonly currentAppVersion: string | null;
  readonly error: GetDeviceStatusDAError | null;
};

export type MachineDependencies = {
  readonly getAppAndVersion: () => Promise<GetAppAndVersionCommandResult>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly waitForDeviceUnlock: (args: {
    input: { unlockTimeout: number };
  }) => Observable<void>;
  readonly setDeviceSessionState: (
    state: DeviceSessionState,
  ) => DeviceSessionState;
  readonly isDeviceOnboarded: () => boolean;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class GetDeviceStatusDeviceAction extends XStateDeviceAction<
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue,
  GetDeviceStatusMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GetDeviceStatusDAOutput,
    GetDeviceStatusDAInput,
    GetDeviceStatusDAError,
    GetDeviceStatusDAIntermediateValue,
    GetDeviceStatusMachineInternalState
  > {
    type types = StateMachineTypes<
      GetDeviceStatusDAOutput,
      GetDeviceStatusDAInput,
      GetDeviceStatusDAError,
      GetDeviceStatusDAIntermediateValue,
      GetDeviceStatusMachineInternalState
    >;

    const {
      getAppAndVersion,
      getDeviceSessionState,
      setDeviceSessionState,
      waitForDeviceUnlock,
      isDeviceOnboarded,
    } = this.extractDependencies(internalApi);

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
        isDeviceOnboarded: () => isDeviceOnboarded(), // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
        isDeviceLocked: ({ context }) => context._internalState.locked,
        hasError: ({ context }) => context._internalState.error !== null,
      },
      actions: {
        assignErrorDeviceNotOnboarded: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new DeviceNotOnboardedError(),
          }),
        }),
        assignErrorDeviceLocked: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new DeviceLockedError(),
          }),
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
          },
        }),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
        assignNoUserActionNeeded: assign({
          intermediateValue: (_) =>
            ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignUserActionUnlockNeeded: assign({
          intermediateValue: (_) =>
            ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.UnlockDevice,
            }) satisfies types["context"]["intermediateValue"],
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwBcAiYBuBLAxmAMpoCGaArrFnoQIL5q4D2AdgHQ0FgBKYpEAJ4BiANoAGALqJQAB2axcTNjJAAPRAFoArAHZx7AIwAmQ7oCcugMyHzANmMAWYwBoQgxI8vsAHOJM+VuLmVj5e2gC+EW6omDjcJORUXPSMLBwA8qwARsykAE4QuKxQAMIAFmD4ANZiUqryisqsqhoImo4O7OGhPj4h5n6Obh4IunZ2RoZ+ena6nYaGUTHoKcRklNTxqc3sWbkFRSUVVbWihtJIII1K6a1aVtoGTxOOjtbv84YjiObik7ofPM7GFDP9jNofMsQLE1olNmsGLsADLMGrFMqVGp1S5yBS3FRXNqaOzadjiHx2KyORbzcRBczmH4IbTOdjaabaKmdGy6XSRaIw1bbdZJLa0MBI9LsVHo45Ys4XBr45r3dps-n0ubaGxgx6PZlWULkkLBGmDCzGYzQ2Ei+HJEVStjsACqsDA+SdrBdrAANmjqmthBA2GB2MVsMxqmG3R6vT7-TU1hJcdcVXciYgglZycYQiYqRTQoZtMynDmbM4aW8rHYzD4BSs4hL7eLuF7Xe7PWk2AmA0GPflmPl2LJfeQAGbDgC2nbjPe9fv7IpTyqaGdAbXmxnZPkMNNM820VuZ+8M7Dsb3MznpwW31sFtpbGwdEo7dFksjorAgADUPYobAnNiIasGGEZRmGT4JC+bY7NKH5fj+-75IBrDAdUCAQfg5DpCmq5XDcqqZmMjgGDY-yGJeejjFRzJ2P47DZoEJb+Hyx42sKz5ioiC7sIh35-gB6QYcIg7DqO45oFO+SztBhCtrxuwCchwlAQqWGsJGOHNPh9SEemhKbogdLsIMTjmPuNF1nYZaOBW+5OPu9l1oCjZCs2ME8Y6fGIb6BC4WwdDYKQuDjtkvq8HAFC+mgokEXi65GeoiBguYZJOPSJa6Hm1hGsyuglkxxiUjYVjXlq7nyaKCI+cpn7+Tp6TBaF4WRXwsAxXFCpiEqBlJS0JFAo4vg+BCe55e8-QFUVVglVShjlWRtZ2FEgqsMwEBwKo1WKXVG5pgNaokmRZmQg4fyLHR7ieCNpjGPyx7aNo6UNo4nGeQpsFKdKax8AIoyJQSg3Ge0L07q9F3+Istk3Qg1IjUaZ7GNS-LlU4H1wt9+3OvseSFBiGFrsDx01mZ15mHooReFaVj0fZ5Jci5zissYIKY3a2NvnxsrVITCrE8RoMdDucxWgx1jpZCELDHDgKTC9jg6mNXKLDSHPcbV3O7LG3bNH2SYioLB3EmCI1-HuVL6Cj4hU6eNjsIVD3UrWfKXVCj5cV5Wvtr5n6CShaFE-1JMkWzPgXpCjh+Faw3Mjq5jdOlJhGvo-RzRr3uvr79VjgFzQtWFpARVFnWxcHQNCylCBm+eKPjJL4jWMEdNww4O46vSFVsfyD5Nlj3na9KRAUPghCwPAIdV20QIR7e-RzOYbNK98cN7ndgR-BSzgo+YmdfYPOfSgAovkQ75MbyVtItehmSrJgcijz2uHD+pmXyQSQnyVLs2tQA */
      id: "GetDeviceStatusDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        const sessionState = getDeviceSessionState();
        const { sessionStateType } = sessionState;
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            onboarded: false, // we don't know how to check yet
            locked: false,
            currentApp:
              sessionStateType ===
              DeviceSessionStateType.ReadyWithoutSecureChannel
                ? sessionState.currentApp.name
                : null,
            currentAppVersion: null,
            error: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "OnboardingCheck",
          },
        },
        OnboardingCheck: {
          // TODO: we don't have this info for now
          always: [
            {
              guard: {
                type: "isDeviceOnboarded",
              },
              target: "AppAndVersionCheck",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  onboarded: true,
                }),
              }),
            },
            {
              target: "Error",
              actions: "assignErrorDeviceNotOnboarded",
            },
          ],
        },
        UserActionUnlockDevice: {
          // we wait for the device to be unlocked (default timeout is 15s)
          entry: "assignUserActionUnlockNeeded",
          exit: "assignNoUserActionNeeded",
          invoke: {
            id: "UserActionUnlockDevice",
            src: "waitForDeviceUnlock",
            input: (_) => ({
              unlockTimeout,
            }),
            onDone: {
              target: "AppAndVersionCheck",
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
        AppAndVersionCheck: {
          // We check the current app and version using the getAppAndVersion command
          invoke: {
            src: "getAppAndVersion",
            onDone: {
              target: "ApplicationAvailableResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    const state: DeviceSessionState = getDeviceSessionState();
                    // Narrow the type to ReadyWithoutSecureChannelState or ReadyWithSecureChannelState
                    if (
                      state.sessionStateType !==
                      DeviceSessionStateType.Connected
                    ) {
                      setDeviceSessionState({
                        ...state,
                        currentApp: _.event.output.data,
                      });
                    }
                    return {
                      ..._.context._internalState,
                      locked: false,
                      currentApp: _.event.output.data.name,
                      currentAppVersion: _.event.output.data.version,
                    };
                  }
                  if (
                    "errorCode" in _.event.output.error &&
                    _.event.output.error.errorCode === "5515"
                  ) {
                    return {
                      ..._.context._internalState,
                      locked: true,
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
        ApplicationAvailableResultCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "UserActionUnlockDevice",
              guard: "isDeviceLocked",
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
      output: (args) => {
        // TODO: instead we should rely on the current state ("Success" or "Error")
        const { context } = args;
        const { error, currentApp, currentAppVersion } = context._internalState;
        if (error) {
          return Left(error);
        }
        return Right<GetDeviceStatusDAOutput>({
          currentApp: currentApp!,
          currentAppVersion: currentAppVersion!,
        });
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getAppAndVersion = () => {
      return internalApi.sendCommand(new GetAppAndVersionCommand());
    };

    const waitForDeviceUnlock = ({
      input,
    }: {
      input: { unlockTimeout: number };
    }) =>
      new Observable<void>((subscriber) => {
        const inner = internalApi
          .getDeviceSessionStateObservable()
          .pipe(
            tap((state) => {
              if (state.deviceStatus === DeviceStatus.CONNECTED) {
                subscriber.complete();
                inner.unsubscribe();
              }
            }),
          )
          .subscribe();

        return () => {
          inner.unsubscribe();
        };
      }).pipe(timeout(input.unlockTimeout));

    return {
      getAppAndVersion,
      waitForDeviceUnlock,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now
    };
  }
}

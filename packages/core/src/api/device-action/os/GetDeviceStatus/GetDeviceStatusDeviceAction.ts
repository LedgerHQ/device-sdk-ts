import { Left, Right } from "purify-ts";
import { Observable } from "rxjs";
import { tap, timeout } from "rxjs/operators";
import {
  AnyEventObject,
  assign,
  fromCallback,
  fromObservable,
  fromPromise,
  setup,
} from "xstate";

import { GetAppAndVersionCommand } from "@api/command/os/GetAppAndVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";

import {
  GetDeviceStatusDAError,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAIntermediateValue,
  GetDeviceStatusDAOutput,
} from "./types";

type GetDeviceStatusMachineInternalState = {
  onboarded: boolean;
  locked: boolean;
  currentApp: string | null;
  currentAppVersion: string | null;
  error: GetDeviceStatusDAError | null;
};

export type MachineDependencies = {
  getAppAndVersion: () => Promise<{ app: string; version: string }>;
  getDeviceSessionState: () => DeviceSessionState;
  waitForDeviceUnlock: (args: {
    input: { unlockTimeout: number };
  }) => Observable<void>;
  saveSessionState: (state: DeviceSessionState) => DeviceSessionState;
  isDeviceOnboarded: () => boolean;
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
  makeStateMachine(internalApi: InternalApi) {
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
      saveSessionState,
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
        saveSessionState: fromCallback(
          ({
            input,
            sendBack,
          }: {
            sendBack: (event: AnyEventObject) => void;
            input: {
              currentApp: string | null;
              currentAppVersion: string | null;
            };
          }) => {
            const { currentApp, currentAppVersion } = input;
            if (!currentApp) {
              return sendBack({ type: "error" });
            }
            const sessionState = getDeviceSessionState();
            const updatedState = {
              ...sessionState,
              currentApp,
              currentAppVersion,
            };
            saveSessionState(updatedState);
            sendBack({ type: "done" });
          },
        ),
      },
      guards: {
        isDeviceOnboarded: () => isDeviceOnboarded(), // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
        isDeviceUnlocked: () =>
          getDeviceSessionState().deviceStatus !== DeviceStatus.LOCKED,
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
        assignErrorSaveAppState: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new UnknownDAError("SaveAppStateError"),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwBcAiYBuBLAxmAMpoCGaArrFnoQIL5q4D2AdgHQ0FgBKYpEAJ4BiANoAGALqJQAB2axcTNjJAAPRAEYAnOPYAOAGwB2TfoDMh8QBZz4gEyGANCEGIArMe3tN5+-vFte3dzbWt7awBfSJdUTBxuEnIqLnpGFg4AeVYAI2ZSACcIXFYoAGEACzB8AGsxKVV5RWVWVQ0Ea1MDd21zfWD3d2txcXcXNwR3Q3N2P3tdf3tNUfNjaNj0VOIySmoEtJb2bLzC4tLK6rrRTWkkECalDLbETs1u3v7BoZGx10R9N7uEbiTSdTzGcxDTTrEBxLZJXZbBiHAAyzFqJXKVVq9VucgUjxUd3auj04kMwXs5O0+gBIPGHkM3gh2kGEQB-nc+hhcP222Se1oYGRGXYaIx52xVxujQJLWeCFJ7HJlOptOWmgZHVB7GshkMy3CrO0mnmURisM2fIRKT5IrY7AAqrAwAV7axHawADbompbYQQNhgdglbDMGrB52u92en21LYSPH3OVPYlaIEzTzicyaYymVmBTV-bWGAz2ebZrnTV7mjbxIU2wXcd1Ol1u9JsWO+-2ugrMArsWRe8gAM37AFtW9GOx7vd2+YnZc1U6B2poM+wszm8zogSateX7OxtMZDENrFybEs-DyrQ2drahS26LJZHRWBAAGquxRsC44wNWGDUNw2DXl7wFJEZ3YF83w-b8Cl-Vh-xqBAQPwcgMkTRc7geeU0wQKlNDeOxrFpaxdE0ExnGLKZ9B8KZ7Bzdxyz6Exb3rRIHybA5RVg98vx-DIUOEXt+0HYc0DHApJ3ArjILtaD+PgoS-ylNDWDDDCWmwhpcJTIlV0QIiSJscjKOorVLHcdgqRzU0QQvMxOg4+FuKgw4iFIbBhVfBEwADIMcPxZdDPUYzOlLU1vmGLx9G0EwtSsGZaXsU8yJ0cRjHmVzrXcxTPO83zZH80SCj7ApguTULWgIiJTx8YJhlimkEuMLUgWMXV5hMMIyINKZogtVhmAgOBVDkwhGw8ldqsJWqjIQABaGiJiWmztE2rbtq2yxcogxECtFLY+AECYQvmhVwg64x6N8fwLBpIwpnMfb5MOp9oOOfIikxFCl0uur9A2kJiKYuxdEhawbruvxaVCWkz2mN6pvyz7UV9P6pQB-DFuMcJZn6YHjBYsIEuh2j9GsTcKJCSwyNpYGUf5D7m2gqN2xaLt4z5HHZrXZYuq3BHSbCKyQnYUwDTIjKmX6NYLUmlnHzZw5lMExDhOx-SaoVXMz2VEYqLzYYmVPDqWMJ-xyXMaxbGy5npqOh0vJ82D-L5sL2lYmzPCpqYyK8O3fgmKZS2mNKhncYjBj1R20dV0UiAofBCFgeAdcBxa0p1GwIXCL4aSLCZkp8OGzFPYwHAVus3IU9HRQAUXK-tPYW8LCNMam89tgYegBKyAVmHqmqsa3tCGyIgA */
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
            locked: sessionState.deviceStatus === DeviceStatus.LOCKED,
            currentApp:
              sessionStateType ===
              DeviceSessionStateType.ReadyWithoutSecureChannel
                ? sessionState.currentApp
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
              target: "LockingCheck",
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
        LockingCheck: {
          // We check if the device is locked in the session state
          always: [
            {
              target: "AppAndVersionCheck",
              guard: {
                type: "isDeviceUnlocked",
              },
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  locked: false,
                }),
              }),
            },
            {
              target: "UserActionUnlockDevice",
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
              target: "SaveAppState",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  currentApp: _.event.output.app,
                  currentAppVersion: _.event.output.version,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  error: new UnknownDAError("GetAppAndVersionError"),
                }),
              }),
            },
          },
        },
        SaveAppState: {
          // We save the current app and version in the session state
          invoke: {
            src: "saveSessionState",
            input: (_) => ({
              currentApp: _.context._internalState.currentApp,
              currentAppVersion: _.context._internalState.currentAppVersion,
            }),
          },
          on: {
            done: {
              target: "Success",
            },
            error: {
              target: "Error",
              actions: "assignErrorSaveAppState",
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
        // TODO: instead we should rely on the current state ("Success" or "Error")
        const { context } = args;
        const { error, currentApp, currentAppVersion } = context._internalState;
        if (error) {
          return Left(error);
        }
        return Right({
          currentApp: currentApp!,
          currentAppVersion,
        });
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getAppAndVersion = () =>
      internalApi.sendCommand(new GetAppAndVersionCommand()).then((res) => ({
        app: res.name,
        version: res.version,
      }));

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
      saveSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now
    };
  }
}

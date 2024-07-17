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

import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/errors";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { DeviceStatus, GetAppAndVersionCommand } from "@api/index";

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
  getDeviceSessionStateObservable: () => Observable<DeviceSessionState>;
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
      getDeviceSessionStateObservable,
      isDeviceOnboarded,
    } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {
          unlockTimeout: 15000,
        } as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        getAppAndVersion: fromPromise(getAppAndVersion),
        checkDeviceUnlocked: fromObservable(
          ({ input }: { input: { unlockTimeout: number } }) =>
            new Observable<void>((subscriber) => {
              const inner = getDeviceSessionStateObservable()
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
            }).pipe(timeout(input.unlockTimeout)),
        ),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwBcAiYBuBLAxmAMpoCGaArrFnoQIL5q4D2AdgHQ0FgBKYpEAJ4BiANoAGALqJQAB2axcTNjJAAPRAEYAnOPYAOAGwB2AEymALOMPb9pgMymANCEGIArMe3tNj7RcMLC01gkwBfMJdUTBxuEnIqLnpGFg4AeVYAI2ZSACcIXFYoAGEACzB8AGsxKVV5RWVWVQ0EC2NNA3d-X1NxLs19FzcEd0N7dkd7cQD7fT6LbVMIqPQk4jJKaljkxvYM7LyCorKK6tFNaSQQeqVU5sQ2jv0u4Mc+7QGhxH0Ohe1bYz6ezaYzWf7LEDRNbxTZrBi7AAyzCqhRK5SqNUucgUtxUVxauj01lM7gs7jsOm09mMXxGNnYxmBoMBnmm4nsEKh23WCS2tDA8NS7CRKOO6LOFzqOMa9wQhPYxNJ5NMlOptOCFnYAUMpiBVPMhh0Fk5q25MMS3MFbHYAFVYGBclbWDbWAAbZGVNbCCBsMDsQrYZiVP12h1Ol3uqprCRY67Su74rTudnsVnU2ziMymQyGdWaQwGBzTF66YwWfTGE0xfnmvncJ22+2OlJsCMer0O3LMXLsWSu8gAM27AFtG2GW863e3uTGpQ0E6AWppk+M0145lmc7TzKZ2CDDJ57AfjAfrO4q9CNhb+Q26LJZHRWBAAGoOxRsE4Yn2sP0BoN+rkayvOsdiFO8HyfV9cnfVhP0qBA-3wchUhjWcrhuGVEwQXpNA6KYFmmY93AcCxaVGfQfFGXVxHEFUjBCC8zWAuEJ3YcDHxfN9Ujg4RO27Xt+zQIdclHQC4mYy1WPYyCuI-cUENYQMkMaVDanQ+M8UXRAcLw6ZdACTxiPsUjXEQI93HYXp7HzSx7HcdwBkrSJIVNIDeRY3YiFIbABXvGEwG9X00OxedNPUbS2gLTQSWiw1TGMByD1pQwU30Ox9H8IFARSpZnLEwhaw8oUvJ88D-N43Iu1yYK41CposMsE8fBi7NooS-N3DIzMtVMEF5gsSxs3iiJnNYZgIDgVR8p5WFJMwkLcXqrSEAAWlzUzVoLGjtp2nbAkYtzZpvVi1j4ARhgW+bwtaZwNs8Cien8PoVVGQEDvE9y5qFfYcnyVE4LnRbZV1CztHcazqS8HNDAysjAR8PwrGI5cTH0d6Cok47EQ9f7xUBq6WjLXdZhBqj-H+Mj9E1UltBSyk5nJNG8tcj6jvrVjQ2bRo2yjbl8YXa7cO61krDGKxoqMWk7PGdodXad5CWNZnq1Z692d2aTOOg7i8fUurZU0E8LO2+Kc2BbMkru4iJjsKlqV1cxM3Rma1dA60St82R-P5sKWnMOzU0BKYBgPazNDInN2DGXUgXzQFjAS53Cq+92KHwQhYHgPWgYa9pNWmUEBhCCx02SlNHp+IJjyVlYVYxz6saFABRSrux9pbrvikIFTacQi6CUuNtmPDerNh2+hzEawiAA */
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
          entry: "assignUserActionUnlockNeeded",
          exit: "assignNoUserActionNeeded",
          invoke: {
            id: "UserActionUnlockDevice",
            src: "checkDeviceUnlocked",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
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

    return {
      getAppAndVersion,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      getDeviceSessionStateObservable: () =>
        internalApi.getDeviceSessionStateObservable(),
      saveSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now
    };
  }
}

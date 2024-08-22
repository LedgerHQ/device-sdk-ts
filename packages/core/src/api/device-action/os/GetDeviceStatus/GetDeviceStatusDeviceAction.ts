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

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetAppAndVersionCommand,
  GetAppAndVersionCommandResult,
} from "@api/command/os/GetAppAndVersionCommand";
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
  readonly saveSessionState: (state: DeviceSessionState) => DeviceSessionState;
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
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwBcAiYBuBLAxmAMpoCGaArrFnoQIL5q4D2AdgHQ0FgBKYpEAJ4BiANoAGALqJQAB2axcTNjJAAPRAEYAnOPYAOAGwB2AEzjxmgMzbj+4wBZDAGhCDEAVmPb2107tN9K2D9UwBfMNdUTBxuEnIqLnpGFg4AeVYAI2ZSACcIXFYoAGEACzB8AGsxKVV5RWVWVQ0EB2NNAw9tKyDta3Egq1d3BA9DK3YrU38HcUMPD0sBiKj0JOIySmpY5Mb2DOy8gqKyiurRTWkkEHqlVObENo79Lp6bfsHhxH0Oh21--R9BxGOaGbQrEDRdbxLbrBh7AAyzCqhRK5SqNSucgUdxU1xauj0c1MhmmfSsTxcbk8YPYxhs8ysmk0HiZrIhUJ2GwS21oYHhqXYSJRJ3R50udRxjQeCEJ7GJpP81kpX1amgc7Cchk0QWmL3+xg5ay5MMSXIFbHYAFVYGBchbWFbWAAbZGVdbCCBsMDsQrYZiVH02u0Op2uqrrCRYm5S+74rSLCZecSzbTjGzBYyqhyaQwGMltPpdcQecKRSHGvmm3ncB3W232lJsMNuj123LMXLsWTO8gAM07AFt6yGm46Xa2uVHJQ046AWizxEnjCnxGngt0rFnqQhpqZ2LZ5trjCvFiYjTEq5szXy63RZLI6KwIAA1O2KNinDFe1g+v0Bn1OSvHk4THdh70fZ831yD9WC-SoEH-fByFSKNp2uW5pXjXdLA6KwU30HMSz6dV9FVMZ9F8MZTDGcRTH6NML2ha8a12QUIKfV931SeDhHbTtu17NAB1yYcgLiFjQL2DioO4z8xUQ1h-WQxo0NqDDYzxedEHMZlJgIoiumZYFVSseZ2HMJkmToswzAWJiTUk80wKIUhsH5B8YTAT1vXQ7FZy09QdLaPNNBoilNBXOj-g8VVDCXAxQlCVktyXGwHOA2FnL2Vz3Igry+NyDtcj8mMAqabDTBC3xwpzKL-G0WKd0WYxNX8erCKXQiInLVhmAgOBVHEwhqykucytxCrtIQABaKkRhmjwD3+FbVpW7wMokkDssFdY+AEEZ-MmmUHFMci7F8KZCKqrdCJ6TaRqc28wIOHJ8lReCZ2OyqXgPVkWRsNcHC6BxzsovxrocW6of0B7uSy57ETdD6xS+rDpscfcekCRqdVCNLyMI9gPD+LxbIiw1y2G+Gb1rMDg0bRoWwjLk0fGhdNHEVrkwcVNIu6UxtxGKxWTpXNTApfwPB0Lw4dGnbLRkriYJ41GNPKmVIvMixcO0HNgnMebPFLSYkrC0tFlmSnVkvLaEbpnK3I82QvLZwKWmmEXibsWYpglxrWXIww83GQIWXaKZ-gcOWnodwUiAofBCFgeB1e+6bBfVeUniBU6T20OKEohgZkymHQY+2xHBQAUSKzs3amoLd3aDUU3aXPBe8Uyfkmdqxka2wix6sIgA */
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
              target: "ApplicationAvailableResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      currentApp: _.event.output.data.name,
                      currentAppVersion: _.event.output.data.version,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: _.event.output.error,
                  };
                },
              }),
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
              target: "SaveAppState",
            },
          ],
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
      saveSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now
    };
  }
}

import { Left, Right } from "purify-ts";
import { Observable } from "rxjs";
import { tap, timeout } from "rxjs/operators";
import {
  assign,
  type EventObject,
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
    } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: null as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        getAppAndVersion: fromPromise(getAppAndVersion),
        checkDeviceUnlocked: fromObservable(
          () =>
            new Observable((subscriber) => {
              const inner = getDeviceSessionStateObservable()
                .pipe(
                  tap((state) => {
                    subscriber.next(state);
                    if (state.deviceStatus === DeviceStatus.CONNECTED) {
                      subscriber.complete();
                      inner.unsubscribe();
                    }
                  }),
                  timeout(15000),
                )
                .subscribe();
            }),
        ),
        saveSessionState: fromCallback<
          EventObject,
          { currentApp: string | null; currentAppVersion: string | null }
        >((_) => {
          const { currentApp, currentAppVersion } = _.input;
          if (!currentApp || !currentAppVersion) {
            return;
          }
          const sessionState = getDeviceSessionState();
          const updatedState = {
            ...sessionState,
            currentApp,
            currentAppVersion,
          };
          saveSessionState(updatedState);
        }),
      },
      guards: {
        isDeviceOnboarded: () => true, // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
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
        assignNoUserActionNeeded: assign({
          intermediateValue: (_) =>
            ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }) satisfies types["context"]["intermediateValue"],
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwBcAiYBuBLAxmAMpoCGaArrFnoQIL5q4D2AdgHQ0FgBKYpEAJ4BiANoAGALqJQAB2axcTNjJAAPRAEYAnOPYAOAGwB2AEzjN4gCz7jmzcYA0IQYgCsxq+xvbDbzTYAzPoehgC+Yc6omDjcJORUXPSMLBwA8qwARsykAE4QuKxQAMIAFmD4ANZiUqryisqsqhoIVnYGbtqBVqbmhn5uhs6uCG5u+uwm2sb6vtpGxsaBEVHoScRklNSxyY3sGdl5BUVlFdWimtJIIPVKqc2IbZodXT19A0MuiIHappM6+kChhshlMRk0KxA0XW8S26wYewAMswqoUSuUqjUrnIFHcVNcWro9OJQVYejMlppTG5ho9euwLIFxNZfINDMFIdCdhsEttaGAEal2MjUScMedLnVcY0HggiQzSeTbIEqTSvghNIE-oDutp-JpOotwpEoWtubDEtzBWx2ABVWBgXLW1i21gAGxRlXWwggbDA7EK2GYlX99sdztdHqq6wk2Ju0vuBK0bnEgXYHnEpl+xnZmc0+lpCFMnnYKuZPSsv0rnSsnLN-ItfO4zrtDqdKTYkc93sduWYuXYsjd5AAZv2ALat8Mdl3u7vc2NShqJ0AtA2p9PGTPZ3OmfOFqwG9hblVWNxZqwmWZ1mINzaW-ktuiyWR0VgQABqjsUbFOmN9rD+oGwb+lyd68vCM7sM+r7vl+uQ-qwf6VAgwH4OQqSxou1y3DKSZFhYzxMmegTjPoVjBBYhb2MYDLMlS3SWCmhgGjeML3k2uxCjBb6ft+qTIcIvb9oOw5oGOuSTmBcQcZBew8XB-G-uKqGsEG6GNFhtQ4Qm+Krog5j2KW1huKR+jkZRmiFsWaZtCY4jaAajmgsaqy3jJEFWlBRCkNgAovrCYA+n6AZqSB7DSYQjZyUKPl+TBgWqepGFsFpca4Su6gGXZ7BUpW+gOT0LGmJ8IyAselbTECVjiLM57aGx5qyV5exxf5siBUJuR9gOQ6jhOEX1h5cItbFvntYlaEpawaVLniTT4aYOV5fMhUlVSpVaCq7DUsygT7Y5pn7REJqsMwEBwKokU8iNj4znNeH6QgAC0m0vYYdHMl933Mh4jXgbdzZQesfACCMOLLnpWWtKYhYeLZsx2D09j2NM-3DQ+QN7AcOT5GiyEPZlLRgm47B6iqS2puZKoFuq8PeIjAR7ijaMmtd0WjTaIqVPj4qE1DLSeH8wTFluMxLcEb2Hmm5HskCgJLDmbjo1FzV3XsYbto0XbRty-MLU99jiLRGbUj8YL6CVgSFsEtFW9YG3Vd0rmmu5queer3Evrx8GIQTOmQwb0MOMCZPaOHoK9CSbRWNZHjHqmTmmKRWbsirN2Y1xNptQlmxgPrsq9KRm7GL4+j5oVQLUUedn9PMNg6F0pjpxznvZxQ+CELA8AB-Nhdbl4wIkr84zJ046rl+mX2kcEvx6pmLdq1jQoAKLdf2BeLQPkw1YYI+W4E48jBRzyW9MpcUVbh7KydQA */
      id: "GetDeviceStatusDeviceAction",
      initial: "DeviceReady",
      context: () => {
        const sessionState = getDeviceSessionState();
        const { sessionStateType } = sessionState;
        return {
          input: null,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            onboarded: false, // we don't know how to check yet
            locked: true,
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
              target: "Error",
              guard: {
                type: "isDeviceOnboarded",
              },
              actions: "assignErrorDeviceNotOnboarded",
            },
            {
              target: "LockingCheck",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  onboarded: true,
                }),
              }),
            },
          ],
        },
        LockingCheck: {
          always: [
            {
              target: "UserActionUnlockDevice",
              guard: {
                type: "isDeviceUnlocked",
              },
            },
            {
              target: "AppAndVersionCheck",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  locked: false,
                }),
              }),
            },
          ],
        },
        UserActionUnlockDevice: {
          invoke: {
            id: "UserActionUnlockDevice",
            src: "checkDeviceUnlocked",
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
            onDone: {
              target: "Success",
            },
            onError: {
              target: "Error",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  error: new UnknownDAError("SaveAppStateError"),
                }),
              }),
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
        const { error, currentApp } = context._internalState;
        if (error) {
          return Left(error);
        }
        return Right({
          currentApp,
        });
      },
    });
  }

  private extractDependencies(internalApi: InternalApi): MachineDependencies {
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
    };
  }
}

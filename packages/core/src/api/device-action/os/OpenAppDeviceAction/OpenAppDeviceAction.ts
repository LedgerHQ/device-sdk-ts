import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { CloseAppCommand } from "@api/command/os/CloseAppCommand";
import { GetAppAndVersionCommand } from "@api/command/os/GetAppAndVersionCommand";
import { OpenAppCommand } from "@api/command/os/OpenAppCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
} from "@api/device-action/os/Errors";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";

import {
  OpenAppDAError,
  OpenAppDAInput,
  OpenAppDAIntermediateValue,
  OpenAppDAOutput,
} from "./types";

type OpenAppStateMachineInternalState = {
  readonly currentlyRunningApp: string | null;
  readonly error: OpenAppDAError | null;
};

export type MachineDependencies = {
  readonly getAppAndVersion: () => Promise<{ app: string; version: string }>;
  readonly closeApp: () => Promise<void>;
  readonly openApp: (arg0: { input: { appName: string } }) => Promise<void>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly isDeviceOnboarded: () => boolean;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

/**
 * Opens a given app on the device.
 *
 * It checks if the device is onboarded, unlocked, and which app is currently open.
 * If the current app is the dashboard, it will directly open the requested app.
 * If another app is opened, it will close the current app and open the requested app.
 *
 * Example of usage:
 *
 * ```ts
 * const deviceAction = new OpenAppDeviceAction({
 *    input: {
 *      appName: "MyApp",
 *    },
 *  });
 * sdk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class OpenAppDeviceAction extends XStateDeviceAction<
  OpenAppDAOutput,
  OpenAppDAInput,
  OpenAppDAError,
  OpenAppDAIntermediateValue,
  OpenAppStateMachineInternalState
> {
  makeStateMachine(internalApi: InternalApi) {
    type types = StateMachineTypes<
      OpenAppDAOutput,
      OpenAppDAInput,
      OpenAppDAError,
      OpenAppDAIntermediateValue,
      OpenAppStateMachineInternalState
    >;

    const {
      getAppAndVersion,
      closeApp,
      openApp,
      getDeviceSessionState,
      isDeviceOnboarded,
    } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        getAppAndVersion: fromPromise(getAppAndVersion),
        closeApp: fromPromise(closeApp),
        openApp: fromPromise(openApp),
      },
      guards: {
        isDeviceOnboarded: () => isDeviceOnboarded(), // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
        isDeviceUnlocked: () =>
          getDeviceSessionState().deviceStatus !== DeviceStatus.LOCKED,
        isRequestedAppOpen: ({ context }: { context: types["context"] }) => {
          if (context._internalState.currentlyRunningApp === null)
            throw new Error("context.currentlyRunningApp === null");
          return (
            context._internalState.currentlyRunningApp === context.input.appName
          );
        },
        isDashboardOpen: ({ context }: { context: types["context"] }) => {
          if (context._internalState.currentlyRunningApp === null)
            throw new Error("context.currentlyRunningApp === null");
          return context._internalState.currentlyRunningApp === "BOLOS";
        },
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
        assignUserActionNeededOpenApp: assign({
          intermediateValue: (_) =>
            ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignNoUserActionNeeded: assign({
          intermediateValue: (_) =>
            ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // FIXME: add a typeguard
          }),
        }),
        assignNoError: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: null,
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHkAOYB2BBVqAiYAbgJYDGYWpALsQPYYB0BJ5ASmAIYQCeAxANoAGALqJQqWrGI16YkAA9EAdgCMDFQE4ALIMEBmLQDZj+gKwaANCG6IVADi3q7xoyq0qPG0wF9vVtJg4+ERkFNR0jMgYAEa0HABOEMQYUADCABZgpADWAiJyElIyGHKKCBoMShqqgloATG56pnoGVjYIeoJKDHamdnrOqu5KTT5+IAHYuMyhlMUMUbEJSSkZWbn8KqJIIIXSEaWIdYZ1DDp6hn3GnUpavW1Hveotel51pkrmGnW+-uhTwRYYXmABlaDlkmlMjk8ttxJJ9rIdmU3AwNF5TJo9FUTipaloHgh6oYGIJTOTarcRloNIZfhN-kEZuQ5hEGGCIatoRstgUEcVDghjqctK47EolIJqvVaYTzgwWmS3HUNOLnL16ZMmSEWeF6AwggAbMgcYpYQgcYiGjjRQ1gXgQehgBjJQi0bLOrXTHXAtlGk1mi1Wm12hCu8GmiJCYTRvlFA7I5SkhrOQwaFRNZwaMmEy7dcxdXQ6D7NPSaxneoGs-X+0iR+jmy3W232sDxeK0eIMVDWqgAM07AFsFhXAbM9Yxa-XsEHm6Hw3XitHYzs9gLE0LLqSWloDHY6nYvKNCc1TOpjtpDLo6voGuXApXx-Mp8U1jCV-D40jQGU9GipQMnxKO8FyGCohiEr0f7gYIdiCGm9SmEYSj3gCzK+jWuDGouERvjycK7PyCY-kcIyVO4gjgaYLgqhB1iIFB6hXs4WIqKo4GodqVYTkwHCwOkSyJHhsJxoiJQbu8ah6CBej2AeIzvISeLwQwlxsRoBjwVe5icY+urzHgfECXEQncgIvKrkR34KIgphkqShj9PYGmfHBlj0QgykkmpIwOGxoqwbpY76WyqSGpIFBYQGEQOk6LoYG6Hojg+wUYYwYURS+ERhglEZLiIH6EV+4kkUSdh2Aq3zgX5FzOaYSnOZUKiYroqgDIYu5Beh1bpeFsCRT20X0LwbYdl2PamgO8TDl6qU9QwGX9Vl9A5W6OH0Mu+SWcVgrARV1Fweq9j6PYSnwWoqiluKXiGJ8ZbjLN3U8bN2HTrFGDOuGSWPT680vUNGCrXlUYFVtn5iYKdTAQw5jAR8rFQ3USlaEhCradRHjtbJXW-c9o6vcUI3tp23a9lNM2jk98z-etgMLtOm0EWuxE2QgYGOLB9S9F0aaHnYSmyacdQqrU2nVCcWg49xz5RbT7BcHwhXM9ZZSqKplFIcBAy9DiSlXt07wSu4TToh193jBgtAQHAcg-dLLPKyVrMALSo5K0mwS4lFkkjHkXD0XifFewtuLddIPZTuMGT68s8KJ66le4MPfKKkoSniN4qEpdR-qqXhSmSpi0X0UtPmyiwmSsULrPHLNlDnpJKLdGluFUWZaEohJ1B3MN4ioB6yZKcH3X8KVU2yHLZJCeG1yriDYk4YH7sYxg3qohIXGedkSgecnaAYpchZhg2042wYtrPTtlM7JLuzeqY6HimL8x5zSnA45XwTnEqdCPDJj1HP0stpwz22hDCSjhvhuQHk3bE2Z6oeSUHBHoghjgZglJROwbFD5pV4vxQSEBQHgwTqzYUqkLyqG7s5fchJtAXSaB3C4LRzDNBwfNRaA0CYOyslfRAdw-wjBxLSFGXRhadw8niaGzhhYNB3FKd4bC8YpS4dZR2kM+i93JMYKoUpsxZwkSqaC-ddBdDgq1FCEcAH22PiojAsd2jELrkcLeOcUb2HqLuJC8ElIUjRB8To4pYES0UfMAAygAV1IOQWA8AwEkLKDoVSHV4Jc1TOYAkEiXAMBzoBNiN4bxjFHmhQB+oACixN4iX0FN8XO1QmgjBaI5C4esOrZJaOKPJqDKS+F8EAA */
      id: "OpenAppDeviceAction",
      initial: "DeviceReady",
      context: ({ input }) => {
        const sessionState = getDeviceSessionState();
        const { sessionStateType } = sessionState;
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            currentlyRunningApp:
              sessionStateType ===
              DeviceSessionStateType.ReadyWithoutSecureChannel
                ? sessionState.currentApp
                : null,
          },
        };
      },
      states: {
        DeviceReady: {
          // check device capabilities & status known
          always: {
            target: "OnboardingCheck",
          },
        },

        OnboardingCheck: {
          // check onboarding status provided by device session
          always: [
            {
              target: "LockingCheck",
              guard: {
                type: "isDeviceOnboarded",
              },
            },
            {
              target: "Error",
              actions: "assignErrorDeviceNotOnboarded",
            },
          ],
        },

        LockingCheck: {
          // check locking status provided by device session
          always: [
            {
              target: "ApplicationAvailable",
              guard: "isDeviceUnlocked",
            },
            {
              target: "Error",
              actions: "assignErrorDeviceLocked",
            },
          ],
        },

        ApplicationAvailable: {
          // execute getAppAndVersion command
          invoke: {
            src: "getAppAndVersion",
            onDone: {
              target: "ApplicationCheck",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  currentlyRunningApp: _.event.output.app,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },

        ApplicationCheck: {
          // Is the current application the requested one
          always: [
            {
              target: "ApplicationReady",
              guard: "isRequestedAppOpen",
            },
            "DashboardCheck",
          ],
        },

        DashboardCheck: {
          // Is the current application the dashboard
          always: [
            {
              target: "OpenApplication",
              guard: "isDashboardOpen",
            },
            "CloseApplication",
          ],
        },

        CloseApplication: {
          invoke: {
            src: "closeApp",
            onDone: {
              target: "OpenApplication",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },

        OpenApplication: {
          // execute openApp command,
          entry: "assignUserActionNeededOpenApp",
          exit: "assignNoUserActionNeeded",
          invoke: {
            src: "openApp",
            input: ({ context }) => ({ appName: context.input.appName }),
            onDone: {
              target: "ApplicationReady",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  currentlyRunningApp: _.context.input.appName,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },

        ApplicationReady: {
          // application is ready to be used
          always: "Success",
        },

        // success state
        Success: {
          type: "final",
          actions: "assignNoError", // TODO, we should not need this
        },

        // error state
        Error: {
          type: "final",
        },
      },
      output: ({ context }) =>
        context._internalState.error // TODO: instead we should rely on the current state ("Success" or "Error")
          ? Left(context._internalState.error)
          : Right(undefined),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getAppAndVersion = async () =>
      internalApi.sendCommand(new GetAppAndVersionCommand()).then((res) => {
        if (isSuccessCommandResult(res)) {
          return { app: res.data.name, version: res.data.version };
        }
        throw res.error;
      });
    const closeApp = async () => {
      const res = await internalApi.sendCommand(new CloseAppCommand());
      if (isSuccessCommandResult(res)) {
        return res.data;
      }
      throw res.error;
    };
    const openApp = async (arg0: { input: { appName: string } }) => {
      const res = await internalApi.sendCommand(
        new OpenAppCommand({ appName: arg0.input.appName }),
      );
      if (isSuccessCommandResult(res)) {
        return res.data;
      }
      throw res.error;
    };

    return {
      getAppAndVersion,
      closeApp,
      openApp,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
    };
  }
}

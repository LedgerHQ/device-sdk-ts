import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  CloseAppCommand,
  type CloseAppCommandResult,
} from "@api/command/os/CloseAppCommand";
import {
  OpenAppCommand,
  type OpenAppCommandResult,
} from "@api/command/os/OpenAppCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { DeviceNotOnboardedError } from "@api/device-action/os/Errors";
import { GetDeviceStatusDeviceAction } from "@api/device-action/os/GetDeviceStatus/GetDeviceStatusDeviceAction";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { DeviceDisconnectedWhileSendingError } from "@api/transport/model/Errors";

import {
  type OpenAppDAError,
  type OpenAppDAInput,
  type OpenAppDAIntermediateValue,
  type OpenAppDAOutput,
} from "./types";

type OpenAppStateMachineInternalState = {
  readonly currentlyRunningApp: string | null;
  readonly error: OpenAppDAError | null;
};

export type MachineDependencies = {
  readonly closeApp: () => Promise<CloseAppCommandResult>;
  readonly openApp: (arg0: {
    input: { appName: string };
  }) => Promise<OpenAppCommandResult>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly setDeviceSessionState: (state: DeviceSessionState) => void;
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
 * dmk.executeDeviceAction({ sessionId: "mySessionId", deviceAction });
 * ```
 */
export class OpenAppDeviceAction extends XStateDeviceAction<
  OpenAppDAOutput,
  OpenAppDAInput,
  OpenAppDAError,
  OpenAppDAIntermediateValue,
  OpenAppStateMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    OpenAppDAOutput,
    OpenAppDAInput,
    OpenAppDAError,
    OpenAppDAIntermediateValue,
    OpenAppStateMachineInternalState
  > {
    type types = StateMachineTypes<
      OpenAppDAOutput,
      OpenAppDAInput,
      OpenAppDAError,
      OpenAppDAIntermediateValue,
      OpenAppStateMachineInternalState
    >;

    const {
      closeApp,
      openApp,
      getDeviceSessionState,
      isDeviceOnboarded,
      setDeviceSessionState,
    } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const getDeviceStatusMachine = new GetDeviceStatusDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        closeApp: fromPromise(closeApp),
        openApp: fromPromise(openApp),
        getDeviceStatus: getDeviceStatusMachine,
      },
      guards: {
        isDeviceOnboarded: () => isDeviceOnboarded(), // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
        isRequestedAppOpen: ({ context }: { context: types["context"] }) => {
          if (context._internalState.currentlyRunningApp === null) return false;
          return (
            context._internalState.currentlyRunningApp === context.input.appName
          );
        },
        isDashboardOpen: ({ context }: { context: types["context"] }) => {
          if (context._internalState.currentlyRunningApp === null)
            throw new Error("context.currentlyRunningApp === null");
          return context._internalState.currentlyRunningApp === "BOLOS";
        },
        hasDisconnectedWhileSending: ({ context }) =>
          context._internalState.error !== null &&
          context._internalState.error instanceof
            DeviceDisconnectedWhileSendingError,
        hasError: ({ context }) => context._internalState.error !== null,
      },
      actions: {
        assignErrorDeviceNotOnboarded: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new DeviceNotOnboardedError(),
          }),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QHkAOYB2BBVqAiYAbgJYDGYWpALsQPYYB0BJ5ASmAIYQCeAxANoAGALqJQqWrGI16YkAA9EARhWCGADgAsAZm1b1SwUoDspgDQhuiAEzX1DbQE5tJlQDYlm414CsAXz8LNEwcfCIyCmo6RmQMACNaDgAnCGIMKABhAAswUgBrARE5CSkZDDlFBCUPbQYfZx91H0FtTRNjCysEbWM1bTdHAzcfH2q9awCg9GxcZgjKMoZYhOTU9Ozcgv4lUSQQEuloiuUauoamlrbzSxtBNTu7pW1BEe1rJUmQYJmwlkjFgAytHyaUyOXyhV24kkh1ke0q7w8DDcxmqjkM1l6Kh8nUQzR8DEEjjcz3UxKUjiMbk+31Cc3IC2iDCBIPW4K2O2KMLKxwQiKUyNRAwxWKUOJu3TaDFsw28bkExmsgnU-Rp0zp4QZUXoDFCABsyBwylhCBxiHqOHE9WBeBB6GAGGlCLQ8g7abNNf8mfrDcbTebLdaEE7gUbokJhBGuaUjvCbCSCdZNI5UQqhg1cQhNOprAxND4XP0xZTHI01SEPX9GTqfaQw-QTWaLVabWAkklaEkGKgLVQAGadgC2S3Vlfm2sYtfr2H9zaDIbrZQjUb2Bx5cb5CelydTxnT2nFXTcmjUBYTzlazkcE0CX1Hv3HiynfqbgbA7FgAFc9VQNhCV9CMZwqAlQuAWZwHiqbStI0mY+PmdRKNYxLZmKgjvDeUwVg+WpPrgBqLtEjYBi2H7fr+7ICJyq7crGIGIK0LwME8dzJuizzNNYmZeLmAysZ4Ph2KYmiaOWPz0l6Nb4b60R-lsRQ0UB5Qbq0pgMM4FJ8dYx4KpomaOJo6k9G4yHvEhBmYmJGpVhOurSYR9ByVRUL7LRwEKAxYq1PUkGtE8+ZaJmBh1A8hieMh17vFZY64UyeAcLAWQrCkTkAa5Sm8tY-TIkmlJvFojjXuocHysiegvB4JJ6P4t7ujhkmMPFiXJRAqXUYBsLKfRfLZSZyYtHYbF2JmQoaMeIweEmJjHtF9XVowGR6pIFD2dOtr2o6GDOq6I7YRJ80MIty3PtEwZbaGS4iGla50R5CBVYSJkFncbzGC4mYoo4zHlfUCo+KieizfttlHbAK09jJ9C8G2HZdj2RoDkkw51cDiyg+DBHTmdzoORgy4KR167dQ9ghPc8A1vUomZIQqeZksmTw9JoJlA56B3oyd9BkT+qUE+lnW8iohgaDoeioUYpgdBKQu5sz8rEgYxjwaJtX3qjTIc6tZTcxRmzOdGAsbqoagmM8Yr-aTTyOCNpXWAW-TGIMfmO6zNmLHVmNlOtGAOiGO0o2ztke5DGDYxd4ZXXzN3uZU1RPBBjTNM7UtdAWxjqQZ6gqv0LyO9oruPkywe49D7adt2vaI8jauB+796e6dC7TvjLnR11d1x955xJ1cKeIAZ6dGEJqJKk4qqq3ttdF-XIc67zrdue3CLVG4gqZyMpbGG4bhBeoq9b-mB7jaTZYT+JU86sX05z5R2wLxlG78oKYpNKW16mx9x6EkhWdGKTSvXgLrFKSENcbsC4Hwa6i9eQHgQgmCkIlBjKmcEFUY24ejaSTMeCkHxPgYFoBAOAcgA5u1um3XkABaHeEoKEEkKvQwQJ4XjKl6ErIBDUmCenATwA2RM7rknUm4FUhV-oiTJFTCUth05j0xJVFUTxt7sIOssRIKRQRyV4bdWOTNkTqDekqAwbxNDIUzFIhwzhZHVHkf0akZ9rKFx1CyPI6j2SaJjsoUsBIBimB8MMeUZJqFdH6PYDwKYBjwQaEYpRtlOYzlfC2NxS8bB6HsM4RUIwiSH0VNxAy6lkL1EEjTYUtisLn1ISAhuDZZxvhvpsRJmVX51FJFlZ4-Qk5wUYcxR2BTTIGUKtEvCoDpwaMUobbqugUzIg8PmEwIiTJ9yqAMaUW90IngCaIgZcUEpJVUa1Vxoy+GVGMbvZiuVf5IM8CoTZOpNZDL4eQjcIlDLIRRH5FhoxDyIGFMiASe8IoFlGNchaS0waxNqfkepG4tACiMGeQw6IiQeBGncMaMycxEl8eoIFu0fiVPbg87qSE3q6MVBpehPQ4K6G+uoZUJIVB7laNiq+2s4DkRGYTLRygs6GSQtmO4iIaWljgvUBgip-K5RErofOdiYocLBZwHhBzOWSkKqKz6Lw3i6U+QgPchlTB7xTPBeCWVHDYoAMqflIOQWA8AlXuO6KMQylImipgMi4BZzhDIKkpM0FEypRimplXNWyABRMuSRIXjNaKvHQ3h0Q0reCYT+3khGNEKgqIRxgAgBCAA */
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
                ? sessionState.currentApp.name
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
              target: "GetDeviceStatus",
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

        GetDeviceStatus: {
          // We run the GetDeviceStatus flow to get information about the device state
          invoke: {
            id: "deviceStatus",
            src: "getDeviceStatus",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "CheckDeviceStatus",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<OpenAppStateMachineInternalState>(
                    {
                      Right: (output) => {
                        const state: DeviceSessionState =
                          getDeviceSessionState();

                        if (
                          state.sessionStateType !==
                          DeviceSessionStateType.Connected
                        ) {
                          setDeviceSessionState({
                            ...state,
                            currentApp: {
                              name: output.currentApp,
                              version: output.currentAppVersion,
                            },
                          });
                        }
                        return {
                          ..._.context._internalState,
                          currentlyRunningApp: output.currentApp,
                        };
                      },
                      Left: (error) => ({
                        ..._.context._internalState,
                        currentlyRunningApp: null,
                        error,
                      }),
                    },
                  );
                },
              }),
            },
            onError: {
              target: "Error",
              actions: [
                assign({
                  _internalState: (_) => ({
                    ..._.context._internalState,
                    currentlyRunningApp: null,
                  }),
                }),
                "assignErrorFromEvent",
              ],
            },
          },
        },
        CheckDeviceStatus: {
          // We check the device status to see if we can have an error
          always: [
            {
              target: "ApplicationReady",
              guard: "isRequestedAppOpen",
              // If target app is currently opened, we can ignore errors
              actions: "assignNoError",
            },
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "DashboardCheck",
            },
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

        OpenApplication: {
          // execute openApp command,
          entry: "assignUserActionNeededOpenApp",
          exit: "assignNoUserActionNeeded",
          invoke: {
            src: "openApp",
            input: ({ context }) => ({ appName: context.input.appName }),
            onDone: {
              target: "OpenApplicationResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      currentlyRunningApp: _.context.input.appName,
                    };
                  } else {
                    return {
                      ..._.context._internalState,
                      error: _.event.output.error,
                    };
                  }
                },
              }),
            },
            onError: {
              target: "OpenApplicationResultCheck",
              actions: "assignErrorFromEvent",
            },
          },
        },

        OpenApplicationResultCheck: {
          always: [
            {
              // When an APDU triggers a disconnection, some transports may possibly
              // be closed on device side before the APDU response could be received,
              // especially on BLE transports.
              // Therefore when a disconnection occurs while sending, we should verify
              // the device status because it may have been successfully executed.
              target: "GetDeviceStatus",
              guard: "hasDisconnectedWhileSending",
            },
            {
              target: "Error",
              guard: "hasError",
            },
            { target: "GetDeviceStatus" },
          ],
        },

        CloseApplication: {
          invoke: {
            src: "closeApp",
            onDone: {
              target: "CloseApplicationResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      currentlyRunningApp: "BOLOS",
                    };
                  } else {
                    return {
                      ..._.context._internalState,
                      error: _.event.output.error,
                    };
                  }
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        CloseApplicationResultCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            { target: "OpenApplication" },
          ],
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
    const closeApp = async () => internalApi.sendCommand(new CloseAppCommand());
    const openApp = async (arg0: { input: { appName: string } }) =>
      internalApi.sendCommand(
        new OpenAppCommand({ appName: arg0.input.appName }),
      );

    return {
      closeApp,
      openApp,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
    };
  }
}

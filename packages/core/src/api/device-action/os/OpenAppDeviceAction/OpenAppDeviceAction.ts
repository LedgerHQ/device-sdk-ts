import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  CloseAppCommand,
  CloseAppCommandResult,
} from "@api/command/os/CloseAppCommand";
import {
  GetAppAndVersionCommand,
  GetAppAndVersionCommandResult,
} from "@api/command/os/GetAppAndVersionCommand";
import {
  OpenAppCommand,
  OpenAppCommandResult,
} from "@api/command/os/OpenAppCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
} from "@api/device-action/os/Errors";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
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
  readonly getAppAndVersion: () => Promise<GetAppAndVersionCommandResult>;
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
      getAppAndVersion,
      closeApp,
      openApp,
      getDeviceSessionState,
      setDeviceSessionState,
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
                      currentlyRunningApp: _.event.output.data.name,
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

        ApplicationAvailableResultCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "ApplicationCheck",
            },
          ],
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
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },

        OpenApplicationResultCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            { target: "ApplicationAvailable" },
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
    const getAppAndVersion = async () =>
      internalApi.sendCommand(new GetAppAndVersionCommand());
    const closeApp = async () => internalApi.sendCommand(new CloseAppCommand());
    const openApp = async (arg0: { input: { appName: string } }) =>
      internalApi.sendCommand(
        new OpenAppCommand({ appName: arg0.input.appName }),
      );

    return {
      getAppAndVersion,
      closeApp,
      openApp,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
    };
  }
}

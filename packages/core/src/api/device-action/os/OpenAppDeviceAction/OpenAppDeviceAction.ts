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
  readonly getAppAndVersion: () => Promise<GetAppAndVersionCommandResult>;
  readonly closeApp: () => Promise<CloseAppCommandResult>;
  readonly openApp: (arg0: {
    input: { appName: string };
  }) => Promise<OpenAppCommandResult>;
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
      /** @xstate-layout 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 */
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
              target: "ApplicationAvailableResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
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
            "OpenApplication",
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
            "ApplicationReady",
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
      isDeviceOnboarded: () => true, // TODO: we don't have this info for now, this can be derived from the "flags" obtained in the getVersion command
    };
  }
}

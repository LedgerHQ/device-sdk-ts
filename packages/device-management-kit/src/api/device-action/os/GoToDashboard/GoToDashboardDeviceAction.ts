import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  CloseAppCommand,
  type CloseAppCommandResult,
} from "@api/command/os/CloseAppCommand";
import {
  GetAppAndVersionCommand,
  type GetAppAndVersionCommandResult,
} from "@api/command/os/GetAppAndVersionCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { UnknownDAError } from "@api/device-action/os/Errors";
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
import { isDashboardName } from "@api/utils/AppName";

import type {
  GoToDashboardDAError,
  GoToDashboardDAInput,
  GoToDashboardDAIntermediateValue,
  GoToDashboardDAOutput,
} from "./types";

type GoToDashboardMachineInternalState = {
  readonly currentApp: string | null;
  readonly error: GoToDashboardDAError | null;
};

export type MachineDependencies = {
  readonly getAppAndVersion: () => Promise<GetAppAndVersionCommandResult>;
  readonly closeApp: () => Promise<CloseAppCommandResult>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly setDeviceSessionState: (
    state: DeviceSessionState,
  ) => DeviceSessionState;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class GoToDashboardDeviceAction extends XStateDeviceAction<
  GoToDashboardDAOutput,
  GoToDashboardDAInput,
  GoToDashboardDAError,
  GoToDashboardDAIntermediateValue,
  GoToDashboardMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GoToDashboardDAOutput,
    GoToDashboardDAInput,
    GoToDashboardDAError,
    GoToDashboardDAIntermediateValue,
    GoToDashboardMachineInternalState
  > {
    type types = StateMachineTypes<
      GoToDashboardDAOutput,
      GoToDashboardDAInput,
      GoToDashboardDAError,
      GoToDashboardDAIntermediateValue,
      GoToDashboardMachineInternalState
    >;

    const {
      getDeviceSessionState,
      setDeviceSessionState,
      closeApp,
      getAppAndVersion,
    } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const getDeviceStatusMachine = new GetDeviceStatusDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);
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
        closeApp: fromPromise(closeApp),
        getDeviceStatus: getDeviceStatusMachine,
      },
      guards: {
        hasError: ({ context }: { context: types["context"] }) => {
          return context._internalState.error !== null;
        },
        isDashboardOpen: ({ context }: { context: types["context"] }) =>
          context._internalState.currentApp !== null &&
          isDashboardName(context._internalState.currentApp),
      },
      actions: {
        // assignGetDeviceStatusUnknownError: assign({
        //   _internalState: (_) => ({
        //     ..._.context._internalState,
        //     error: new UnknownDAError("GetDeviceUnknownStatusError"),
        //   }),
        // }),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHED2AVVARAhrAFgEao4BOEWYAbgJYDGYAgnQC42oB2AdJbQwEpgcEAJ4BiANoAGALqJQAB1SwabTvJAAPRAHYAjFwDMATikA2MwA5DOnQBYArGeOGANCBGI9VrlcvmpRyknQwcAXzD3NExcAmIyCmp6JlZ2bmQwFl5kgGUWHBYAV1gxCE4wLhoOKlQAawqIJIY8guLpOSQQJRU1Dg1tBAAmOy49QYcpHQdBvR0pMcszO3dPBEM7My4HYz1pqWNLPRsdJYiojGw8IhJybIZmXq4AYXwwOlq7sBaikvaNbtUaX6iDsgy2g3Wdksjn8JlBDhWiAchk2OkMgysB2RzlBZxA0UucRuiT4KUeLzeHyaX3yP0keg6imUgPUnQGgxmo3hdkcemMwwcG0RCGxXDRGMsWJRxlxkXxF1i1wSnweaR4V3i5Ap70ksn+zN6wIQfMsYsG0LMg2MZlm60mwucDi4HMli0GgX0zjxBMVmpJyVVnHVRIS2tq9MZXQNQLZII5XEcoQx5kO3mWHkQjud5oOlo93mM3oVGuJKtSQd9xLDkkGkYBhtjCEtxi41h5fJs+ysOgdOjBE2Gw1sUmC5qLMRLyupge4ldDrx1EkMdejrNAA2sTu8jsO0Lsej5wr7prsoTGs2CJz748JStu0-L3CeABtlEwFApSuVKtU6hUfZO96kjOzyvrA74KAgVQ1HQBRpO0fydPWMbrl4kwGFMzizMYcyCsK-gjE4OiWBC-jGDK+g3nOQEBo+oFvowH5iGApCkKgpBcAoz4FAAZuxAC2XAASGNH3HRL4MR+UG-rBvQIXqSGrn0jaHGCNocoYko2BiUzCvymyadsdg6Dh+zTFRgH+mJ5JgRB1aIUyPQoVoaHEWKegjsYDgOGi9hjMKHmGAYdg7KCVhLOagoWSJVlkmqEngYxCj2Qy+pOWuLnGuMUhcNagoHMZgqhMYAVSEFCahRKEWWFFcrCXesUgRkLBJYwHAQAAaixKicF+HAVNBf5CcWMVlo8zWte1XWkD1HDSTBcGcPJK7pcpqEIARCZQsMqZSDM+7Cg4limjaXnbHMlhzIYERyhwqCNPAnT1X6Y3OchGUDAAtDKvj6NYgQohYljCsMRjzIYASTN2NjXXVI0Na9FbUoIwirI5LJrZloJcCOI52GVZihD5goIhmxoHq24OQycl02NFCMPuNmSfN8xRpRjRqfRsv16P9p4WFYIOGIYCYjgex1mD5oLrPTL2M-FC5UqSrOPejDbrbMraniZ+4nGV6J6OmqwbJsl3jPY2wQ2YaKy6W8sVpZYbs+rmUzDl4y84T7rBDyZgOvsWvqd4EI67bU7AeJtlJc7zkbnyYrBORxGaVCDh6PhhtGAcJjjPye3EWHolxUGCV2YrMcfWhFi5TyjgUYb9h+2TFG+GMIUhRyUy7IXjV0RNH5tZ13VvUpRpjOYYpBWZCxzOnZNHQZGweSR7qhDLcMTqN9vcDkhR0AwsCq1Gq1GhyIxWvsSYWMZ-I9mTJGEbXsx7Av4Qb7ecsR48ACirHsRXmMBjIi2JaRwEIDzeWtsDMmgUdCthwjadSaJFiWBumEIAA */
      id: "GoToDashboardDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        const sessionState = getDeviceSessionState();
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            currentApp:
              "currentApp" in sessionState
                ? sessionState.currentApp.name
                : null,
            error: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "GetDeviceStatus",
          },
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
                  return _.event.output.caseOf<GoToDashboardMachineInternalState>(
                    {
                      Right: (output) => ({
                        ..._.context._internalState,
                        currentApp: output.currentApp,
                      }),
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  );
                },
              }),
            },
            // NOTE: The way we handle our DeviceActions means that we should never as we return an Either
            // onError: {
            //   target: "Error",
            //   actions: "assignGetDeviceStatusUnknownError",
            // },
          },
        },
        CheckDeviceStatus: {
          // We check the device status to see if we can have an error
          always: [
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
          // We check if the dashboard is open
          always: [
            {
              target: "Success",
              guard: "isDashboardOpen",
            },
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "Error",
              guard: (_) => {
                return _.context._internalState.currentApp === null;
              },
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  error: new UnknownDAError("currentApp === null"),
                }),
              }),
            },
            {
              target: "CloseApp",
            },
          ],
        },
        CloseApp: {
          invoke: {
            src: "closeApp",
            onDone: {
              target: "CloseAppCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return _.context._internalState;
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
        CloseAppCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "GetAppAndVersion",
              reenter: true,
            },
          ],
        },
        GetAppAndVersion: {
          invoke: {
            src: "getAppAndVersion",
            onDone: {
              target: "DashboardCheck",
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
                      currentApp: _.event.output.data.name,
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
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: (_) => {
        if (_.context._internalState.error) {
          return Left(_.context._internalState.error);
        }

        return Right(undefined);
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const closeApp = async () => internalApi.sendCommand(new CloseAppCommand());
    const getAppAndVersion = async () =>
      internalApi.sendCommand(new GetAppAndVersionCommand());

    return {
      closeApp,
      getAppAndVersion,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}

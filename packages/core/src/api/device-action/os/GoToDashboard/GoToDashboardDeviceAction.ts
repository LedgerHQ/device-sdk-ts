import { Left, Right } from "purify-ts";
import {
  AnyEventObject,
  assign,
  fromCallback,
  fromPromise,
  setup,
} from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { CloseAppCommand } from "@api/command/os/CloseAppCommand";
import { GetAppAndVersionCommand } from "@api/command/os/GetAppAndVersionCommand";
import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { GetDeviceStatusDeviceAction } from "@api/device-action/os/GetDeviceStatus/GetDeviceStatusDeviceAction";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";
import { DeviceSessionState } from "@api/device-session/DeviceSessionState";

import {
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
  readonly getAppAndVersion: () => Promise<{ app: string; version: string }>;
  readonly closeApp: () => Promise<void>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly saveSessionState: (state: DeviceSessionState) => DeviceSessionState;
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
  makeStateMachine(internalApi: InternalApi) {
    type types = StateMachineTypes<
      GoToDashboardDAOutput,
      GoToDashboardDAInput,
      GoToDashboardDAError,
      GoToDashboardDAIntermediateValue,
      GoToDashboardMachineInternalState
    >;

    const {
      getDeviceSessionState,
      saveSessionState,
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
        saveSessionState: fromCallback(
          ({
            input,
            sendBack,
          }: {
            sendBack: (event: AnyEventObject) => void;
            input: {
              currentApp: string;
            };
          }) => {
            const { currentApp } = input;
            const sessionState = getDeviceSessionState();
            const updatedState = {
              ...sessionState,
              currentApp,
            };
            try {
              saveSessionState(updatedState);
              sendBack({ type: "done" });
            } catch (error) {
              sendBack({ type: "error" });
            }
          },
        ),
      },
      guards: {
        isDashboardOpen: ({ context }: { context: types["context"] }) =>
          context._internalState.currentApp === "BOLOS",
        isDeviceStatusError: ({ context }: { context: types["context"] }) => {
          return context._internalState.error !== null;
        },
      },
      actions: {
        // assignGetDeviceStatusUnknownError: assign({
        //   _internalState: (_) => ({
        //     ..._.context._internalState,
        //     error: new UnknownDAError("GetDeviceUnknownStatusError"),
        //   }),
        // }),
        assignErrorSaveAppState: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new UnknownDAError("SaveAppStateError"),
          }),
        }),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // FIXME: add a typeguard
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHED2AVVARAhrAFgEao4BOEWYAbgJYDGYAgnQC42oB2AdJbQwEpgcEAJ4BiANoAGALqJQAB1SwabTvJAAPRAEYAnFK4AOAGwB2HUYAsAZik2TOqwCYANCBG7LXM85MBWG39ne38pHRsAX0j3NExcAmIyCmp6JlZ2bmQwFl40gGUWHBYAV1gxCE4wLhoOKlQAa2qIVIZC4rLpOSQQJRU1Dg1tBEdnLh0TKykzez1-eb09d08EEJMuKwnzfxMbGyM9ZyMjaNiMbDwiEnI8hmYBrmzc1rB20vKwUlJUUi4FABtigAzH4AWy4LT4ryK7y6Gj6qkyQ0Qo3Gk2ms3m-kWy0QRh0XDCUmJTnsNh0OmczlOIDiF0S1xSUPumS4AGF8GA6A1btCOuU4T0EQNkQgKVJ1lYTFIDOFjsSrFZcatnDYfH5-C4STYrP4dDS6QkrsleSzOOzOdzeW8ypIdN1FMpEeoesNxZLpbLLEYFUqPIgbIdCWYfVY5pT5o4TAbzkakjcXmbuHHGRyuQ1JLJ4U6Ra7dMFDBNNjpiTMdno-St9gSZnZ-EZnGZ5mGdP4Y-FLvGmWkkzxO6nLRmJPbs-0kXmxcE9MGm3r-DMTJNldLDHppc5KQEQiHqTFabH+ybExlzSnkmnuZJnA7ejnx6A3YECfOzFGDJYTM5-MrfOtVY3rD2UJDnbeljQTZkT24Nl-mUJgFAUCoqhqOpGmqQ1DwgnsoPZWDYHghQEFqeo6GKTIukFR0xxdB9dDXIwuH2ACtSsJsJWXA4uHMNcgijKx8V3M4OwZI9IIeGC4MYBCxE+b5fgBYEwUeA8RKwu4cIk-CpMI4jUFIgYKKzIU7xorQ6JMBimJDFi2JMH8bDMcYzDXTYfVrV9QLPNT0geJ5tMYDgIAANU+FROCQjhql0pplOE8Du3U3ycn8wKQtIMKOCI1D9PI2RKNvajBgnfRfC4ewKQsvQzAcjcjGVQJHJCckpHmb0dhOPcMNUhKfNZPyEIC4LQsyGSvh+P5ARYEFSHBLr4tNHD+oUQa0oyrKSLIzhDJvYV7zM1ZFTGT09h9KlqqCerAnGfQLMcClXzMKxPMwnre3yHAqFeOAMreMAIrAfLdtMt16MYhtrJCViwjs-0EH49Za1JecpAbY5nu6haHnez78m+zJftGuTAZMoraLFUGrOsSHbOVHUxipAJm2mL9NSiGkOFQFp4B6Oau0xvagdJ-aAFoYZWYX-C4RZFjMZzZ18cJ5nR+bjweXlBGEFYqOdIXhhcZV7vVRn62cVjGeVvnVb6nJrRhMpRx10UjkluZyVVetA03MXEArLgGc1CsJTNtmhLAy2xNZC8eReG1ue13MyYMacjkpEtnLCfRlSpSy9BsVUHPnPRKSbC3GX508Xqjh2E-2iIv0JKUdxCGUHJsWmDGMI4UakRVFWCJXOpUlWI-NTSCOrva3VfQwZhaqdKQrZdnI2ZwXLuyqJVL0TsKSlgUqG9KBZJp2bsYnuF30KlVUu58eJCb0LOsLfvLej6vtgH6YTACfgd0XxHKMEEA4Rh6xFx2JWAMOwNiBBRgBMBn4zDP1ejhfIJQ6AMA-j-XWiBV5HClrnfEWIZi92VPxSWuo7BNn2FML8SDy7cAAKJjVIFgp22wG4WScE+HY35YYOCsNA8kJYZS2CqlVaI0QgA */
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
              "currentApp" in sessionState ? sessionState.currentApp : null,
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
              guard: "isDeviceStatusError",
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
              target: "SaveSessionState",
              guard: "isDashboardOpen",
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
              target: "GetAppAndVersion",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetAppAndVersion: {
          invoke: {
            src: "getAppAndVersion",
            onDone: {
              target: "DashboardCheck",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  currentApp: _.event.output.app,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SaveSessionState: {
          invoke: {
            src: "saveSessionState",
            input: (_) => ({
              // NOTE: DashboardCheck will error if currentApp is null so we can safely assume it's not null here
              currentApp: _.context._internalState.currentApp!,
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
      output: (_) => {
        if (_.context._internalState.error) {
          return Left(_.context._internalState.error);
        }

        return Right(undefined);
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const closeApp = async () => {
      const res = await internalApi.sendCommand(new CloseAppCommand());
      if (isSuccessCommandResult(res)) {
        return res.data;
      }
      throw res.error;
    };
    const getAppAndVersion = async () =>
      internalApi.sendCommand(new GetAppAndVersionCommand()).then((res) => {
        if (isSuccessCommandResult(res)) {
          return { app: res.data.name, version: res.data.version };
        }
        throw res.error;
      });

    return {
      closeApp,
      getAppAndVersion,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      saveSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}

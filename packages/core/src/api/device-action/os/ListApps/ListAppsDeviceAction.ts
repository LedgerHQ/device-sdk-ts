import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  AppResponse,
  ListAppsCommand,
  ListAppsCommandResult,
} from "@api/command/os/ListAppsCommand";
import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";

import {
  ListAppsDAError,
  ListAppsDAInput,
  ListAppsDAIntermediateValue,
  ListAppsDAOutput,
} from "./types";

type ListAppsMachineInternalState = {
  readonly error: ListAppsDAError | null;
  readonly apps: AppResponse[];
  readonly shouldContinue: boolean;
};

export type MachineDependencies = {
  readonly listApps: ({
    input,
  }: {
    input: boolean;
  }) => Promise<ListAppsCommandResult>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class ListAppsDeviceAction extends XStateDeviceAction<
  ListAppsDAOutput,
  ListAppsDAInput,
  ListAppsDAError,
  ListAppsDAIntermediateValue,
  ListAppsMachineInternalState
> {
  makeStateMachine(internalApi: InternalApi) {
    type types = StateMachineTypes<
      ListAppsDAOutput,
      ListAppsDAInput,
      ListAppsDAError,
      ListAppsDAIntermediateValue,
      ListAppsMachineInternalState
    >;

    const { listApps } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const goToDashboardMachine = new GoToDashboardDeviceAction({
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
        listApps: fromPromise<ListAppsCommandResult, boolean>(listApps),
        goToDashboard: goToDashboardMachine,
      },
      guards: {
        hasError: ({ context }: { context: types["context"] }) => {
          return context._internalState.error !== null;
        },
        hasMoreApps: (_) => _.context._internalState.shouldContinue,
      },
      actions: {
        assignAllowListApps: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: UserInteractionRequired.AllowListApps,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // FIXME: add a typeguard
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QBkCWsAuBBADj2AImAG6oDGYWZGqA9gHYB0RpFASmAIYQCeAxAG0ADAF1EoHLVioaDcSAAeiAIwBOIYwAcANgDsyzat2HlAJgDMegDQgeKg412ntAVm3mdp1af0uAvn42aJi4+CzklNR0TADitAAqtAScsAAWAEa0nABOEHwQDGCMqPTEtADWRRApGVm5wmJIIJLSsvTySgguquaMACy6rvrKfSOqfTZ2CKZC2v3K2ou6xn2mms7+gSDB2HiEJBFUbYxxiclpmTl5YNnZtNmMOAA2nBgAZvcAtozVF3UQDXkLRk0Q6iG6vQGQ2UIzGE1siE0ykYLiEaLRuiECxcbmUASC6F2YQOFCO0ROCSSNUuuQAwqkwGRyoJRECpCC5E1OsosZpHAZBi5zKpuhjJohTBZHBt3N5UapVGp8dtCaF9qxIsdTlS-ld6YzmQJlI0JOy2mCEDyHPpNILhaKhLpxQg+kI+ZjzGZdD0seYPMqdmrwqSogxGIG9vlCsVShUihHiRqyWGE7AECUymRXtEGoCmsDzVyVAM+cpzGtzKjvdp1ppnZWNNosW4+sLNEJUdo+gHVXtg5ryam+Dc7g9nq8Ptlvqn+8mmKn07Gs21c6z82bQUXLSXGGWK1XVDW1s6XMZ+kKzLaZk3XD2Qn2SQOU738HwFJhXkVOG8MDcABTKKiaIAJR8DOj5zuGL6wHmpqtJuoDcjue6aA21a1s6ejIuo2imDiCy6H0PS6HeRLqocobztBtIMDQ9AAK5gFG9BFBmcZQfeiYUccqY0fQdGMYumbZgwq4ms0G6cohKiaC4pZCOMQjlu4bguPWqyMJKrhdpKmLLNopFBhBlEcWRfECUxI73I8LzvF8plGUmJm8bRJSCWxy45qIsESfBUmKBKMzIjMnpyTitp+uY9ZyburYWDCfQ1ro5aGQ+TnHOZblMT5BYIQFlqoaojDaCK5iuq2XY1s6iW6I4h54bJlheKlXEhhlrkMdlxpsn57RbgYbiMLMeFrLpMxCiewqOOV4xEai6x4sq9C0BAcDyOB6V5bl-mdAAtNozq7S4jAKqdFgKdW+4teRbXkv2HDcFMcEcn10kuqYzowrVTjaR4TXrNds4mdq5y1FcPUvRaazHaVl5Cq66hqQiCDjJpMplQYmijClWwbdx5Ig9S-z6kyEOFm97bIqsh4KsKZYlQdyOSnywrluYsxDJTmwEpxN1PlRvNk3l3IGMiOIDB2ZWtq6H3I5WtV9BePhYm6gymIDxk8dRHWMULO0SlicyyYBPRlt4jXRXM2hqN6lg8j0GubWGmWdXrr35QsOhDbJh5+l44XwlM5hOCixhej4Ip9Ei3a49BQPHAAyvRZAULA8Drr1UM4nMMxeM4NaoR4TrI0KOczX0cWKo7+NhgAorc9xu1DoxFYBuE6O2OgKfWZ46EYimzAsXYBAEQA */
      id: "ListAppsDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            apps: [],
            shouldContinue: false,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "GoToDashboard",
          },
        },
        GoToDashboard: {
          invoke: {
            id: "dashboard",
            src: "goToDashboard",
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
              target: "GoToDashboardCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<ListAppsMachineInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GoToDashboardCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "ListApps",
            },
          ],
        },
        ListApps: {
          // NOTE: This is a timeout that is currently not used
          // We need to discuss this as a team, how do we want to
          // handle the case when the user does not validate or reject on the device
          // after: {
          //   15000: "Error",
          //   actions: assign({
          //     _internalState: (_) => ({
          //       error: new UnknownDAError("ListAppsTimeout"),
          //     }),
          //   }),
          // },
          entry: "assignAllowListApps",
          invoke: {
            src: "listApps",
            input: (_) => false,
            onDone: {
              target: "Continue",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      apps: _.context._internalState.apps.concat(
                        _.event.output.data,
                      ),
                      shouldContinue: _.event.output.data.length === 2,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: _.event.output.error,
                  };
                },
                intermediateValue: (_) => ({
                  ..._.context.intermediateValue,
                  requiredUserInteraction: UserInteractionRequired.None,
                }),
              }),
            },
          },
        },
        ListAppsCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            "ListAppsContinue",
          ],
        },
        ListAppsContinue: {
          invoke: {
            src: "listApps",
            input: (_) => true,
            onDone: {
              target: "Continue",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      apps: _.context._internalState.apps.concat(
                        _.event.output.data,
                      ),
                      shouldContinue: _.event.output.data.length === 2,
                    };
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
        Continue: {
          always: [
            {
              target: "ListAppsContinue",
              guard: "hasMoreApps",
            },
            {
              target: "Success",
            },
          ],
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

        return Right(_.context._internalState.apps);
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const listApps = async ({ input }: { input: boolean }) => {
      const command = new ListAppsCommand({ isContinue: input });
      return internalApi.sendCommand(command);
    };

    return {
      listApps,
    };
  }
}

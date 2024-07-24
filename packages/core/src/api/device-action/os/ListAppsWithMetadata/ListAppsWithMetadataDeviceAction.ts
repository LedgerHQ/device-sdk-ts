import { Left, Right } from "purify-ts";
import {
  AnyEventObject,
  assign,
  fromCallback,
  fromPromise,
  setup,
} from "xstate";

import { ListAppsResponse } from "@api/command/os/ListAppsCommand";
import { InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { ListAppsDeviceAction } from "@api/device-action/os/ListApps/ListAppsDeviceAction";
import { ListAppsDAOutput } from "@api/device-action/os/ListApps/types";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";
import { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { ApplicationEntity } from "@internal/manager-api/model/ManagerApiResponses";

import {
  ListAppsWithMetadataDAError,
  ListAppsWithMetadataDAInput,
  ListAppsWithMetadataDAIntermediateValue,
  ListAppsWithMetadataDAOutput,
} from "./types";

type ListAppsWithMetadataMachineInternalState = {
  error: ListAppsWithMetadataDAError | null;
  apps: ListAppsResponse;
  appsWithMetadata: ListAppsWithMetadataDAOutput;
};

export type MachineDependencies = {
  getAppsByHash: ({
    input,
  }: {
    input: ListAppsDAOutput;
  }) => Promise<ApplicationEntity[]>;
  getDeviceSessionState: () => DeviceSessionState;
  saveSessionState: (state: DeviceSessionState) => DeviceSessionState;
};

export class ListAppsWithMetadataDeviceAction extends XStateDeviceAction<
  ListAppsWithMetadataDAOutput,
  ListAppsWithMetadataDAInput,
  ListAppsWithMetadataDAError,
  ListAppsWithMetadataDAIntermediateValue,
  ListAppsWithMetadataMachineInternalState
> {
  makeStateMachine(internalAPI: InternalApi) {
    type types = StateMachineTypes<
      ListAppsWithMetadataDAOutput,
      ListAppsWithMetadataDAInput,
      ListAppsWithMetadataDAError,
      ListAppsWithMetadataDAIntermediateValue,
      ListAppsWithMetadataMachineInternalState
    >;

    const { getAppsByHash, saveSessionState, getDeviceSessionState } =
      this.extractDependencies(internalAPI);

    const unlockTimeout = this.input.unlockTimeout ?? 0;

    const listAppsMachine = new ListAppsDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalAPI);

    return setup({
      types: {
        input: {
          unlockTimeout,
        } as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        listApps: listAppsMachine,
        getAppsByHash: fromPromise<ApplicationEntity[], ListAppsDAOutput>(
          getAppsByHash,
        ),
        saveSessionState: fromCallback(
          ({
            input,
            sendBack,
          }: {
            sendBack: (event: AnyEventObject) => void;
            input: {
              appsWithMetadata: ApplicationEntity[];
            };
          }) => {
            const { appsWithMetadata } = input;
            if (!appsWithMetadata) {
              return sendBack({ type: "error" });
            }

            const sessionState = getDeviceSessionState();
            const updatedState = {
              ...sessionState,
              installedApps: appsWithMetadata,
            };
            saveSessionState(updatedState);
            sendBack({ type: "done" });
          },
        ),
      },
      guards: {
        hasError: ({ context }: { context: types["context"] }) => {
          return context._internalState.error !== null;
        },
        hasNoAppsInstalled: ({ context }: { context: types["context"] }) =>
          context._internalState.apps.length === 0,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // FIXME: add a typeguard
          }),
        }),
        assignErrorSaveAppState: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new UnknownDAError("SaveSession Error"),
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QBkCWsAuBBADj2A6qhgBYCyYGAhhFdQCJgBuqAxmFqxqgPYB2AOkYt2AJTA0AngGIA2gAYAuolA4esYrz4qQAD0QBGAJzyBADgBsAdgNX5Fow6NWjAGhCTDBswKsAmCwBWPwAWPwBmM0DjAwBfWPc0TFx8IlIKaloGZjYOLi0BJOw8WGkIfjABVD4mHgBrSoAbdGL8BWUkEDUNbn4dfQRgnyM-b0D5Kwt5EKsbd08EUKsBKYNAswn7eTMrMz94xJaUwmJySho6KmFczl7BIuPpMAAnZ55ngRxGugAzd4BbATNZIldo6bqaPqdAZDAQjMYTKYzOYeRBmAwCEJGbEWCzo+QGeQTA4gB4lNJnTKXa7sW4FMn4ADCJDArDqciU4PUkO00MQRgMGJCZhC4XCuMmAXk4XmiHWgUx9j8IqigUCeLiCVJR3JpwyF2yIjyd0KOqZLLZcgMHVU3Lu-X5gsxIrFEosUplqIQFnCQvsvuiyvsFhCJIZJ3S5yyVxytPy-FNIPNrPZsj8Nq6dq0DoQAqFLvF1ndU09CwCGLs4W2gRC42xzisYbNEcpBpjRrpCYAYpRWK3o2UKlUavVKjBWrAAEKSAASVFgJDBnQh9r5CDW8gVPr8diJBPGQVlCEiFelBnCJjMF4F+y14Yp+ujNONBR7GD7j8uT1e70+3wwfzPIC47HNOc4Lkuto9Nma4blu4Q7nu+72IER5+BEvgBIE4RWMKjhWIERjhE2SYtp+ho3PGggAMpUEwYDUXAGj8IOfBgJBmbQVCoADMYNYCIEsyWMEwZFkeITuoq25BKMZiWLehykQ+UbUrGL4JrR9GMbAzF8N+bzPBxK4wTxhhGPxgm7DJomTEe4oKuZvrbAYDh+NEazxFqfA8BAcA6PeeoqRRcarlBPI5gAtBYR5RQISHhBJB4mOeRgkROylUsF6mCM+4hSFyXG8qZCBhEegrLP4QSirYiHoqld7NhlbbPp29zNgV4VrsqDnYYSV4GH48joX4R5GCEAjoUEwRBOKGwhKGDVKYFmXtpRJrhsyKYdaFeiIFY4rmLhziipYU1uF6ARGAJuyEv4xiTO6aXHE1T5qa1Ahvh+QVUNtJm7euLnhJi2IiiMRLhNNaEHbWvoRGKCFqj6T26pGK0tVRAiaQxTF-cZ3H-bYBjjWeRNVg4FhE3ZGwCLYzgI-I5n7bYyOpMtzVvRj1EAK6sOwOm-fjAxwwqwSRP4bmilYR7RBYNOzc4uJquemqKelbOvR2GMAKI-s8AtFf9sl+AJvqEuKY12DsaFYnF2HVrWREBJEnmxEAA */
      id: "ListAppsWithMetadataDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: _.input,
          _internalState: {
            error: null,
            apps: [],
            appsWithMetadata: [],
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "ListApps",
          },
        },
        ListApps: {
          invoke: {
            id: "listApps",
            src: "listApps",
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
              target: "ListAppsCheck",
              actions: assign({
                intermediateValue: (_) => ({
                  requiredUserInteraction: UserInteractionRequired.None,
                }),
                _internalState: (_) => {
                  return _.event.output.caseOf({
                    Right: (apps) => ({
                      ..._.context._internalState,
                      apps,
                    }),
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
              actions: [
                "assignErrorFromEvent",
                assign({
                  intermediateValue: (_) => ({
                    requiredUserInteraction: UserInteractionRequired.None,
                  }),
                }),
              ],
            },
          },
        },
        ListAppsCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "Success",
              guard: "hasNoAppsInstalled",
              actions: assign({
                _internalState: (_) => {
                  return {
                    ..._.context._internalState,
                    appsWithMetadata: [],
                  };
                },
              }),
            },
            {
              target: "FetchMetadata",
            },
          ],
        },
        FetchMetadata: {
          invoke: {
            id: "getAppsByHash",
            src: "getAppsByHash",
            input: (_) => _.context._internalState.apps,
            onDone: {
              target: "SaveSession",
              actions: assign({
                _internalState: (_) => {
                  return {
                    ..._.context._internalState,
                    appsWithMetadata: _.event.output,
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
        SaveSession: {
          invoke: {
            src: "saveSessionState",
            input: (_) => ({
              appsWithMetadata: _.context._internalState.appsWithMetadata,
            }),
          },
          on: {
            done: {
              target: "Success",
            },
            error: {
              target: "Error",
              actions: "assignErrorFromEvent",
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

        return Right(_.context._internalState.appsWithMetadata);
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      getAppsByHash: async ({ input }) => {
        const res = await internalApi.managerApiService.getAppsByHash(input);
        return res;
      },
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      saveSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}

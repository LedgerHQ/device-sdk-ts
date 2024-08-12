import { EitherAsync, Left, Right } from "purify-ts";
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
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { ListAppsDeviceAction } from "@api/device-action/os/ListApps/ListAppsDeviceAction";
import { ListAppsDAOutput } from "@api/device-action/os/ListApps/types";
import { StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import { XStateDeviceAction } from "@api/device-action/xstate-utils/XStateDeviceAction";
import { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";
import { Application } from "@internal/manager-api/model/ManagerApiType";

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
  }) => EitherAsync<HttpFetchApiError, Array<Application | null>>;
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

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

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
        getAppsByHash: fromPromise(getAppsByHash),
        saveSessionState: fromCallback(
          ({
            input,
            sendBack,
          }: {
            sendBack: (event: AnyEventObject) => void;
            input: {
              appsWithMetadata: Array<Application | null>;
            };
          }) => {
            const { appsWithMetadata } = input;

            const filterted = appsWithMetadata.filter((app) => app !== null);

            const sessionState = getDeviceSessionState();
            const updatedState = {
              ...sessionState,
              installedApps: filterted,
            };
            try {
              saveSessionState(updatedState);
              sendBack({ type: "done" });
            } catch (error) {
              sendBack({ type: "error", error });
            }
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
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QBkCWsAuBBADj2A6qhgBYCyYGAhhFdQCJgBuqAxmFqxqgPYB2AOkYt2AJTA0AngGIA2gAYAuolA4esYrz4qQAD0QBGAJzyBADgBsAdgNWAzPIAs8+TceOANCEmILAJjMBKwsHOyMjAzN7SIBfGK80TFx8IlIKaloGZjYOLi0BROw8WGkIfjABVD4mHgBrCoAbdCL8BWUkEDUNbn4dfQQAVgCBIz9IgacQ6z8-Lx8Ef1N5OwsBlbs7dyNHCziE5uTCYnJKGjoqYRzOHsFCw+kwACdHnkeBHAa6ADNXgFsBJpJYptHRdTS9Dr9IaBUbjSYrKwzOaIMwGAQTFx2MxmOx+AYDKxGAZ7EB3YqpE4Zc6XdjXfJk-AAYRIYFYtTkSlB6nB2khKKGAj89jCRjCFmWdmRCD8LiCGIMMysqIsCpJDKOaVOmQu2VpeX4BQOxWZrPZsgM7VU3JufX5fkFwvCYolUqVjkFyxlA3FeO9VjVRpSx3SZyyIlyN0NQKZLLZcj8ls61q0toQZgFQo2TqM4o2UosjjsQRC8iFa1GfiJAejGspoZ14bpBoAYpRWHXtaVypVqnUKjAWrAAEKSAASVFgJBBHTBNr5CAM7gsAkcY3TZmW-iMiPzm0Flkc2PX8gMTmrg4pIe1NIj+VbGHbV-OD2er3enwwP0e-wHhxH48nacrW6FN50XHYVzXAYNxWSsd28RA7GMQUMUcaCLFFTZdniUlA1rJ8wyufVBHvR8tXOE04yApMQIhUB+kiVYBFLTYbBmPwCwsKUdjRRxghVMwAlWSIjHPQ5L3Iwi9UjUiOwo2MzQtLlaN5ejDEsAZmL8ViFRmTj8wLSDt3kbFtzGZYxPJYNJIbIjIwAZSoJgwHsuANH4Ls+DAajZ1AtTpQ4wJnH8UyHB9fNgiMjCzCdcUzEcSyg01KkpNvA1HOc1zYHcvgXxeR4fOTOi9EQPSgvkEKYrC0spQJIwRn4pw8QLAwQjiHC+B4CA4B0dUJJS2zpL8mieVTABaLiEIQMbNPCOb5vmyxEvwmybybQQb3EKRlNG+dV3zIVizCxwc3sPxlv6+s1uIqNBx2ud-ICWa1lPexsWMb18ycQUS3FfEFTsb0LusgbrsjdVKNqe7hv6CwogECwCxPQGhSsNCjHzVdmIMMKBgMBV8eMYHkqu3U0pIts5OoaHioY093QCEwMNFJV5Gg-NInRHGKoqnNSzR4mqcG8mBFkgiqEhmnVJKhdVndQTlncKxXCsfF829H6HFsEJvSFbD9hrS7rzJ9aBAyly3OG3zadK-nzAGUUzKsQlxQxqaQnq2xt1XNnnBMuxBfFsH8nsgBXVh2GyqXUzxCqBEB7YxlXGLIisV0cy5sLlcR53RUD1aTZugBRV9Hmj+dY+XBPV0XRnU9qyxzGiiqNwmOxgnamIgA */
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
              entry: "assignErrorFromEvent",
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
              target: "FetchMetadataCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output
                    .map((appsWithMetadata) => ({
                      ..._.context._internalState,
                      appsWithMetadata,
                    }))
                    .mapLeft((error) => ({
                      ..._.context._internalState,
                      error,
                    }))
                    .extract();
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        FetchMetadataCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "SaveSession",
            },
          ],
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
      getAppsByHash: ({ input }) => internalApi.getMetadataForAppHashes(input),
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      saveSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}

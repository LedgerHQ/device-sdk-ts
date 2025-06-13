import {
  type DeviceActionStateMachine,
  type InternalApi,
  MissingDataDAError,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, Just, Nothing, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type GetTrustchainRootDAError,
  type GetTrustchainRootDAInput,
  type GetTrustchainRootDAIntermediateValue,
  type GetTrustchainRootDAInternalState,
  type GetTrustchainRootDAOutput,
  type TrustchainsResponse,
} from "@api/app-binder/GetTrustchainIdDeviceActionTypes";
import { type JWT } from "@api/app-binder/LKRPTypes";

import { continueAction } from "./utils/continueAction";
import { requiredToEither } from "./utils/required";

export class GetTrustchainIdDeviceAction extends XStateDeviceAction<
  GetTrustchainRootDAOutput,
  GetTrustchainRootDAInput,
  GetTrustchainRootDAError,
  GetTrustchainRootDAIntermediateValue,
  GetTrustchainRootDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GetTrustchainRootDAOutput,
    GetTrustchainRootDAInput,
    GetTrustchainRootDAError,
    GetTrustchainRootDAIntermediateValue,
    GetTrustchainRootDAInternalState
  > {
    type types = StateMachineTypes<
      GetTrustchainRootDAOutput,
      GetTrustchainRootDAInput,
      GetTrustchainRootDAError,
      GetTrustchainRootDAIntermediateValue,
      GetTrustchainRootDAInternalState
    >;

    const { fetchAccessibleTrustchains } =
      this.extractDependencies(internalApi);

    const required = requiredToEither(MissingDataDAError);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        fetchAccessibleTrustchains: fromPromise(fetchAccessibleTrustchains),
      },

      actions: {
        continue: continueAction(),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      id: "SignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          trustchainId: Nothing,
          trustchains: Nothing,
        }),
      }),

      states: {
        InitialState: {
          always: "FetchAccessibleTrustchains",
        },

        FetchAccessibleTrustchains: {
          on: {
            trustchainExist: "StoreTrustchainId",
            noTrustchain: "Error", // TODO handle trustchain creation
            error: "Error",
          },
          invoke: {
            id: "fetchAccessibleTrustchains",
            src: "fetchAccessibleTrustchains",
            input: () => required({ jwt: this.input.jwt }),
            onError: { actions: "assignErrorFromEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map((trustchains) => ({
                    type:
                      Object.keys(trustchains).length > 0
                        ? "trustchainExist"
                        : "noTrustchain",
                    state: {
                      trustchains: Just(trustchains),
                    },
                  })),
              },
            },
          },
        },

        StoreTrustchainId: {
          on: { success: "Success", error: "Error" },
          entry: {
            type: "continue",
            params: ({ context }) =>
              context._internalState
                .chain((state) => {
                  const trustchainId = state.trustchains.chainNullable(
                    (trustchains) =>
                      Object.entries(trustchains).find(([, info]) =>
                        Object.keys(info).some((path) => path === "m/"),
                      )?.[0],
                  );
                  return trustchainId.toEither(
                    new UnknownDAError("No root ID found in trustchains"),
                  );
                })
                .map((trustchainId) => ({
                  type: "success",
                  state: { trustchainId: Just(trustchainId) },
                })),
          },
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.chain((state) =>
          state.trustchainId.toEither(
            new MissingDataDAError("trustchainId is missing"),
          ),
        ),
    });
  }

  extractDependencies(_internalApi: InternalApi) {
    return {
      fetchAccessibleTrustchains: async (_: {
        input: Either<MissingDataDAError, { jwt: JWT }>;
      }): Promise<Either<GetTrustchainRootDAError, TrustchainsResponse>> =>
        Promise.resolve(Right({} as TrustchainsResponse)), // TODO
    };
  }
}

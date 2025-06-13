import {
  type DeviceActionStateMachine,
  type InternalApi,
  InvalidLKRPCredentialsDAError,
  MissingDataDAError,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, Just, Left, Maybe, Nothing, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type AuthenticateDAError,
  type AuthenticateDAInput,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAInternalState,
  type AuthenticateDAOutput,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import { type JWT, type KeyPair } from "@api/app-binder/LKRPTypes";

import { continueAction } from "./utils/continueAction";
import { requiredToEither } from "./utils/required";
import { EnsureIsMemberDeviceAction } from "./EnsureIsMemberDeviceAction";
import { GetTrustchainIdDeviceAction } from "./GetTrustchainIdDeviceAction";

export class AuthenticateDeviceAction extends XStateDeviceAction<
  AuthenticateDAOutput,
  AuthenticateDAInput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue,
  AuthenticateDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    AuthenticateDAOutput,
    AuthenticateDAInput,
    AuthenticateDAError,
    AuthenticateDAIntermediateValue,
    AuthenticateDAInternalState
  > {
    type types = StateMachineTypes<
      AuthenticateDAOutput,
      AuthenticateDAInput,
      AuthenticateDAError,
      AuthenticateDAIntermediateValue,
      AuthenticateDAInternalState
    >;

    const { webAuth, deviceAuth } = this.extractDependencies(internalApi);

    const required = requiredToEither(MissingDataDAError);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        webAuth: fromPromise(webAuth),
        deviceAuth: fromPromise(deviceAuth),

        getTrustchainId: new GetTrustchainIdDeviceAction({
          input: {
            jwt: Maybe.fromNullable(this.input.jwt),
          },
        }).makeStateMachine(internalApi),

        ensureIsMember: new EnsureIsMemberDeviceAction({
          input: {
            applicationId: this.input.applicationId,
            keypair: this.input.keypair,
            jwt: Maybe.fromNullable(this.input.jwt),
          },
        }).makeStateMachine(internalApi),
      },

      actions: {
        continue: continueAction(),
        assignErrorFromEvent: assign({
          _internalState: (_): AuthenticateDAInternalState =>
            Left((_.event as unknown as { error: AuthenticateDAError }).error), // NOTE: it should never happen, the error is not typed anymore here
        }),
      },
    }).createMachine({
      id: "AuthenticateDeviceAction",
      initial: "InitialState",
      context: ({ input }): types["context"] => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          trustchainId: Maybe.fromNullable(input.trustchainId),
          newJwt: Nothing,
          applicationPath: Nothing,
          encryptionKey: Nothing,
        }),
      }),
      states: {
        InitialState: {
          always: "CheckCredentials",
        },

        CheckCredentials: {
          always: [
            {
              target: "DeviceAuth",
              guard: ({ context }) =>
                context._internalState
                  .toMaybe()
                  .chain((s) => s.trustchainId)
                  .isJust(),
            },
            {
              target: "EnsureIsMember",
              guard: ({ context }) =>
                context._internalState
                  .toMaybe()
                  .chain((s) => s.newJwt)
                  .map((jwt) => jwt.exp > Date.now() / 1000)
                  .orDefault(false),
            },
            { target: "WebAuth" }, // TODO: Check if the JWT can be renfreshed
          ],
        },

        WebAuth: {
          on: {
            success: "EnsureIsMember",
            invalidCredentials: "DeviceAuth",
            error: "Error",
          },
          invoke: {
            id: "webAuth",
            src: "webAuth",
            input: ({ context }) =>
              context._internalState.chain((state) =>
                required({
                  keypair: this.input.keypair,
                  trustchainId: state.trustchainId,
                }),
              ),
            onError: { actions: "assignErrorFromEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.caseOf({
                    Left: (error) =>
                      error instanceof InvalidLKRPCredentialsDAError
                        ? Right({ type: "invalidCredentials" })
                        : Left(error),
                    Right: (jwt) =>
                      Right({ type: "success", state: { newJwt: Just(jwt) } }),
                  }),
              },
            },
          },
        },

        DeviceAuth: {
          on: { success: "GetTrustchainId", error: "Error" },
          invoke: {
            id: "deviceAuth",
            src: "deviceAuth",
            onError: { actions: "assignErrorFromEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map((jwt) => ({
                    type: "success",
                    state: { newJwt: Just(jwt) },
                  })),
              },
            },
          },
        },

        GetTrustchainId: {
          on: { success: "GetTrustchainId", error: "Error" },
          invoke: {
            id: "getTrustchainId",
            src: "getTrustchainId",
            input: ({ context }) => ({
              jwt: context._internalState
                .toMaybe()
                .chain((state) => state.newJwt)
                .alt(Maybe.fromNullable(this.input.jwt)),
            }),
            onError: { actions: "assignErrorFromEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map((trustchainId) => ({
                    type: "success",
                    state: { trustchainId: Just(trustchainId) },
                  })),
              },
            },
          },
        },

        EnsureIsMember: {
          on: {
            success: "Success",
            invalidCredentials: "WebAuth",
            error: "Error",
          },
          invoke: {
            id: "ensureIsMember",
            src: "ensureIsMember",
            input: ({ context }) => ({
              applicationId: this.input.applicationId,
              keypair: this.input.keypair,
              jwt: context._internalState
                .toMaybe()
                .chain((state) => state.newJwt)
                .alt(Maybe.fromNullable(this.input.jwt)),
            }),
            onError: { actions: "assignErrorFromEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ context, event }) =>
                  event.output.caseOf({
                    Left(error) {
                      if (!(error instanceof InvalidLKRPCredentialsDAError)) {
                        return Left(error);
                      }
                      return context._internalState.chain((state) =>
                        state.newJwt.isNothing()
                          ? Right({ type: "invalidCredentials" })
                          : Left(error),
                      );
                    },
                    Right: (result) =>
                      Right({
                        type: "success",
                        state: {
                          applicationPath: Just(result.applicationPath),
                          encryptionKey: Just(result.encryptionKey),
                        },
                      }),
                  }),
              },
            },
          },
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.chain((s) =>
          required({
            trustchainId: s.trustchainId,
            applicationPath: s.applicationPath,
            encryptionKey: s.encryptionKey,
            jwt: s.newJwt.alt(Maybe.fromNullable(this.input.jwt)),
          }),
        ),
    });
  }

  extractDependencies(_internalApi: InternalApi) {
    return {
      webAuth: (_: {
        input: Either<
          AuthenticateDAError,
          {
            keypair: KeyPair;
            trustchainId: string;
          }
        >;
      }): Promise<Either<AuthenticateDAError, JWT>> =>
        Promise.resolve(Right({} as JWT)), // TODO

      deviceAuth: (): Promise<Either<AuthenticateDAError, JWT>> =>
        Promise.resolve(Right({} as JWT)), // TODO
    };
  }
}

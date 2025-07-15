import {
  type DeviceActionStateMachine,
  type InternalApi,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type AuthenticateDAError,
  type AuthenticateDAInput,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAInternalState,
  type AuthenticateDAOutput,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import {
  LKRPMissingDataError,
  LKRPUnhandledState,
} from "@api/app-binder/Errors";
import { SignChallengeWithDeviceTask } from "@internal/app-binder/task/SignChallengeWithDeviceTask";
import {
  type AuthenticationPayload,
  type Challenge,
} from "@internal/lkrp-datasource/data/LKRPDataSource";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";

import { raiseAndAssign } from "./utils/raiseAndAssign";

const APP_NAME = "Ledger Sync";

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

    const required = <T>(prop: T | undefined | null, errorMsg: string) =>
      Maybe.fromNullable(prop).toEither(new LKRPMissingDataError(errorMsg));

    const { deviceAuth } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
        deviceAuth: fromPromise(deviceAuth),
      },

      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_): AuthenticateDAInternalState =>
            Left((_.event as unknown as { error: AuthenticateDAError }).error), // NOTE: it should never happen, the error is not typed anymore here
        }),
      },
    }).createMachine({
      id: "AuthenticateDeviceAction",
      initial: "CheckCredentials",
      context: ({ input }): types["context"] => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          trustchainId: null,
          jwt: null,
          applicationPath: null,
          encryptionKey: null,
        }),
      }),
      states: {
        CheckCredentials: {
          always: [
            { target: "DeviceAuth", guard: () => !this.input.trustchainId },
            { target: "WebAuth", guard: () => !this.input.jwt },
            { target: "GetEncryptionKey" },
          ],
        },

        WebAuth: {
          on: {
            success: "GetEncryptionKey",
            invalidCredentials: "DeviceAuth",
            error: "Error",
          },
          // TODO: Implement web authentication
        },

        DeviceAuth: {
          on: { success: "GetEncryptionKey", error: "Error" },
          initial: "OpenApp",
          states: {
            OpenApp: {
              on: { success: "Auth" },
              invoke: {
                id: "openApp",
                src: "openAppStateMachine",
                input: { appName: APP_NAME },
                onDone: {
                  actions: raiseAndAssign(({ event }) =>
                    event.output.map(() => ({ raise: "success" })),
                  ),
                },
              },
            },

            Auth: {
              invoke: {
                id: "deviceAuth",
                src: "deviceAuth",
                onDone: {
                  actions: raiseAndAssign(({ event }) =>
                    event.output.chain((payload) =>
                      payload.trustchainId.caseOf({
                        Nothing: () =>
                          Left(
                            new LKRPUnhandledState("The trustchain is empty"),
                          ),
                        Just: (trustchainId) =>
                          Right({
                            raise: "success",
                            assign: { jwt: payload.jwt, trustchainId },
                          }),
                      }),
                    ),
                  ),
                },
              },
            },
          },
        },

        GetEncryptionKey: {
          on: {
            success: "Success",
            invalidCredentials: "WebAuth",
            error: "Error",
          },
          entry: ({ context }) =>
            context._internalState.ifRight((state) =>
              console.log("State:", state),
            ), // TODO: Implement get encryption key
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.chain((state) =>
          eitherSeqRecord({
            trustchainId: () =>
              required(
                state.trustchainId ?? this.input.trustchainId,
                "Missing Trustchain ID in the output",
              ),
            jwt: () =>
              required(
                state.jwt ?? this.input.jwt,
                "Missing JWT in the output",
              ),
            applicationPath: () =>
              required(
                state.applicationPath,
                "Missing application path in the output",
              ),
            encryptionKey: () =>
              required(
                state.encryptionKey,
                "Missing encryption key in the output",
              ),
          }),
        ),
    });
  }

  extractDependencies(_internalApi: InternalApi) {
    return {
      deviceAuth: () =>
        this.auth(new SignChallengeWithDeviceTask(_internalApi)),
    };
  }

  private auth(signerTask: {
    run: (
      challenge: Challenge,
    ) => Promise<Either<AuthenticateDAError, AuthenticationPayload>>;
  }) {
    return this.input.lkrpDataSource
      .getChallenge()
      .chain((challenge) => signerTask.run(challenge))
      .chain((payload) => this.input.lkrpDataSource.authenticate(payload))
      .run();
  }
}

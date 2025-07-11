import {
  type DeviceActionStateMachine,
  type InternalApi,
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
import { LKRPMissingDataError } from "@api/app-binder/Errors";
import { SignChallengeWithDeviceTask } from "@internal/app-binder/task/SignChallengeWithDeviceTask";
import {
  type AuthenticationPayload,
  type Challenge,
} from "@internal/lkrp-datasource/data/LKRPDataSource";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";

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
            { target: "EnsureIsMember" },
          ],
        },

        WebAuth: {
          on: {
            success: "EnsureIsMember",
            invalidCredentials: "DeviceAuth",
            error: "Error",
          },
          // TODO: Implement web authentication
        },

        DeviceAuth: {
          on: { success: "EnsureIsMember", error: "Error" },
          invoke: {
            id: "deviceAuth",
            src: "deviceAuth",
            onDone: {
              actions: ({ event }) => {
                // TODO: replace by actual logic
                console.log(
                  "Device Auth",
                  ...event.output.caseOf<[string, unknown]>({
                    Left: (error) => ["Error", error],
                    Right: (response) => ["Success", response],
                  }),
                );
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
          // TODO: Implement ensure is member
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

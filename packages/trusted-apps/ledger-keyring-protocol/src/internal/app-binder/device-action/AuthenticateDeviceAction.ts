import {
  type DeviceActionStateMachine,
  type InternalApi,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Maybe, Right } from "purify-ts";
import { assign, setup } from "xstate";

import {
  type AuthenticateDAError,
  type AuthenticateDAInput,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAInternalState,
  type AuthenticateDAOutput,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import { LKRPMissingDataError } from "@api/app-binder/Errors";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";

export class AuthenticateDeviceAction extends XStateDeviceAction<
  AuthenticateDAOutput,
  AuthenticateDAInput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue,
  AuthenticateDAInternalState
> {
  makeStateMachine(): DeviceActionStateMachine<
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

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {},

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
            { target: "DeviceAuth", guard: () => !!this.input.trustchainId },
            { target: "WebAuth", guard: () => !!this.input.jwt },
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
          on: { success: "GetTrustchainId", error: "Error" },
          // TODO: Implement device authentication
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
    return {};
  }
}

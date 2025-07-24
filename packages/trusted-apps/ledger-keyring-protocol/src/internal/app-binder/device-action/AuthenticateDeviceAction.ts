import {
  type DeviceActionStateMachine,
  type InternalApi,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Right } from "purify-ts";
import { fromPromise, setup } from "xstate";

import {
  type AuthenticateDAError,
  type AuthenticateDAInput,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAInternalState,
  type AuthenticateDAOutput,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import {
  LKRPMissingDataError,
  LKRPUnauthorizedError,
  LKRPUnhandledState,
} from "@api/app-binder/Errors";
import { SignChallengeWithDeviceTask } from "@internal/app-binder/task/SignChallengeWithDeviceTask";
import { SignChallengeWithKeypairTask } from "@internal/app-binder/task/SignChallengeWithKeypairTask";
import {
  type AuthenticationPayload,
  type Challenge,
  type LKRPDataSource,
} from "@internal/lkrp-datasource/data/LKRPDataSource";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { required } from "@internal/utils/required";

import { raiseAndAssign } from "./utils/raiseAndAssign";
import { GetEncryptionKeyDeviceAction } from "./GetEncryptionKeyDeviceAction";

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

    const { deviceAuth, keypairAuth } = this.extractDependencies(internalApi);

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
        keypairAuth: fromPromise(keypairAuth),

        getEncryptionKeyStateMachine: new GetEncryptionKeyDeviceAction({
          input: Left(
            new LKRPMissingDataError("Missing input for GetEncryptionKey"),
          ),
        }).makeStateMachine(internalApi),
      },

      actions: {
        assignErrorFromEvent: raiseAndAssign(
          ({ event }) =>
            Left(
              new UnknownDAError(String((event as { error?: unknown }).error)),
            ), // NOTE: it should never happen, the error is not typed anymore here
        ),
      },

      guards: {
        hasNoTrustchainId: ({ context }) => !context.input.trustchainId,
        hasNoJwt: ({ context }) => !context.input.jwt,
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEECuAXAFmAduglgMYCG6YAImAG5FjKEED2OAdAMLaEDWbATpLgLEANrADEAbQAMAXUSgADo1j4mOeSAAeiAMxSALC30BOHfoDsAJinGAHADYp94wBoQAT0QBaAKwsf9lYBAIzB9jrm5vr6OgC+sW5oWIJEpBTUtPRq7Jw8-BApIuISwXJIIEoqahraCDrBOizG+pb2tq06PlJStvo+bp4IPsZSLBHBprZWnVI+tvGJGNh4qWSUNIR0DPjMOWDcfAIrRZKWZYrKqjvq5bU6lsZGkbY+ATbmtk79Hoi2f0+WT7hfT2HyA8wLEBJZYEEhrDKbLLXFgAaTA7gUxHwvGhYggzDALHwOCojC4hPJGKxOKW0nOFUu1VuiHs0RYlhMYOewWGHIGiB8+mCRh0nWsnR0bRakOhKTh6Q2W2yaKp2NxYF4vEYvBYCmEpAAZtqALYsSmYtW02QaSpXZg1Fn1fwtfS2YyBVm2YKWfkIaLmJqfGKs0F2czumVLOVpdaZba7FUWmlYMSwVCETawWB0m2M64OhDGSx+QLGcxdcxSYIggy+yvCv6s4zNKTl17zBJQqMreWxxHx1iJ6m44lUET4CCHArHUQ58q2pmgWpu0ZCoUPIuWKJmX0+SssWb2Cb3IWRAyR5I9mMIpXIoeWlMarW8OcXKr55mFiJNNfRYJSSxq3MHRfVBAMgJ8HQi3-UFAQvGFVgVONsj7OgllTdNM2za15zze1PwacMWH-MIwXqWYqxAn4EEA2wjBid0rHMexAJ0DtFkvWFr0VJFdlQ9VNW1V8GXffCl0QBpjGFSVRUgiJw0g31q0MUUDC3YZKz0Np4OjeEeIHFh+KWFgAHkFFwZAFAUPECSJEkyUJRhzJwSyFGEhcP3EhB7FBJpIgeb1LAiL0fWo4JgOI+o91ZILjEFD4dKvPTkORIysFM5zXLEJ9tV1fV0CNXhTSciyrPcvCbi81lDFeQUgrMe5bHuOtHkCXobAmF5mImRKuOS-sUJvaEMtK6y0wzOBsPpDyxK0RApPsA9zH-V0+h8as2l9B4at6bqYpeOJO1lJKkIG1KhuM3F8RwQlRwclgCh4q1poqgt-1MFh2i6CYPh6DolP+QDXXLRwej+EFesQ-iDLSzAWAE588sNE0HourBytEyq5oQf8iKghoTBGcJXiowZmhYbrKyatsbDsSHeyGgyAHEwHQABRHBCF4DE1BVGybrs0lyRYGB2c57mFF59EMbtLHanCyUjHCQInDBk9fSaxpPlo0itweex6e4lLdhZsWuZ564+ZynU9WRoqRdZjnzcly3pZwt9Zbe4DwPqStBWcI9bDrfRRjMEZlK3TpgkN-rbxNx3xYt5g+fGrCZcXbHgj+AMOTikPojsTbqLLOjWndX22Ozg2ju7PrTrj1hTadiWpfcMRR3HSd8kKWd3ZEz3Px8xaQxY102p5cwlNmQxCfuKRVPLCEa84qHGeyJvE5d5P0WywSXz7ma5Ykt1HnW70hXW4CJn0X0i0aHk2I3OLYo7TscEYAp4HKY66+hjPD4LJ8Yi-4piBAmGERwk9qJeDimMQCcw5gNHWi0HwMd668VYBwfYeQjhCFELmTGb1ATAJ6MxZaC1IG+i8AGL0VgTCUUBHFJqaC-53nREmaEBCB5eS5BTUUboYJdHnt8QY4RHiNkcC6BonxUHLwQgzfSg0npYC4RnWovDmwPEBDIr0QdoE0Pgb0LcPI5igJYWvc6yi4ZmVGqozy2M9x+E0UWP4sxdFbWWv4XawYTCijMOYxRljMiXSWHY2a8t56PFCFWVkkFlbRC2g4FgPkgyAlaK0ZaATjaNwTs7VuYSj442+k8Uw8VOhj2CLfe47ISauimF6HoWSzq7AAMqYUmgUgs1gIpNUsFuRw7oVw32LpEA8P0oLrVmKYppDcWBsz3p0z83TFrX29I4b04ZQpk0Ak0eegQhRTA+IBeI8QgA */

      id: "AuthenticateDeviceAction",
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

      initial: "CheckCredentials",
      states: {
        CheckCredentials: {
          always: [
            { target: "DeviceAuth", guard: "hasNoTrustchainId" },
            { target: "KeypairAuth", guard: "hasNoJwt" },
            { target: "GetEncryptionKey" },
          ],
        },

        KeypairAuth: {
          on: {
            success: "GetEncryptionKey",
            invalidCredentials: "DeviceAuth",
            error: "Error",
          },
          invoke: {
            id: "keypairAuth",
            src: "keypairAuth",
            input: ({ context }) => ({
              lkrpDataSource: context.input.lkrpDataSource,
              keypair: context.input.keypair,
              trustchainId: required(
                context.input.trustchainId,
                "Missing Trustchain ID in the input",
              ),
            }),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output
                  .map(({ jwt }) => ({
                    raise: "success",
                    assign: { jwt },
                  }))
                  .chainLeft((error) =>
                    error instanceof LKRPUnauthorizedError
                      ? Right({ raise: "invalidCredentials" })
                      : Left(error),
                  ),
              ),
            },
          },
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
                onError: { actions: "assignErrorFromEvent" },
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
                input: ({ context }) => context.input,
                onError: { actions: "assignErrorFromEvent" },
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
            invalidCredentials: "KeypairAuth",
            error: "Error",
          },
          invoke: {
            id: "getEncryptionKey",
            src: "getEncryptionKeyStateMachine",
            input: ({ context }) =>
              eitherSeqRecord({
                lkrpDataSource: context.input.lkrpDataSource,
                applicationId: context.input.applicationId,
                keypair: context.input.keypair,
                trustchainId: () =>
                  context._internalState
                    .toMaybe()
                    .chainNullable(
                      ({ trustchainId }) =>
                        trustchainId ?? context.input.trustchainId,
                    )
                    .toEither(
                      new LKRPMissingDataError(
                        "Missing Trustchain ID in the input for GetEncryptionKey",
                      ),
                    ),
                jwt: () =>
                  context._internalState
                    .toMaybe()
                    .chainNullable(({ jwt }) => jwt ?? context.input.jwt)
                    .toEither(
                      new LKRPMissingDataError(
                        "Missing JWT in the input for GetEncryptionKey",
                      ),
                    ),
              }),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map((output) => ({
                  raise: "success",
                  assign: output,
                })),
              ),
            },
          },
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.chain((state) =>
          eitherSeqRecord({
            trustchainId: () =>
              required(
                state.trustchainId ?? context.input.trustchainId,
                "Missing Trustchain ID in the output",
              ),
            jwt: () =>
              required(
                state.jwt ?? context.input.jwt,
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

  extractDependencies(internalApi: InternalApi) {
    return {
      deviceAuth: (args: { input: { lkrpDataSource: LKRPDataSource } }) =>
        this.auth(
          args.input.lkrpDataSource,
          new SignChallengeWithDeviceTask(internalApi),
        ).run(),

      keypairAuth: (args: {
        input: Pick<AuthenticateDAInput, "lkrpDataSource" | "keypair"> & {
          trustchainId: Either<LKRPMissingDataError, string>;
        };
      }) => {
        const { lkrpDataSource, keypair } = args.input;
        return EitherAsync.liftEither(args.input.trustchainId)
          .chain((trustchainId) =>
            this.auth(
              lkrpDataSource,
              new SignChallengeWithKeypairTask(keypair, trustchainId),
            ),
          )
          .run();
      },
    };
  }

  private auth(
    lkrpDataSource: LKRPDataSource,
    signerTask: {
      run: (
        challenge: Challenge,
      ) => PromiseLike<Either<AuthenticateDAError, AuthenticationPayload>>;
    },
  ) {
    return lkrpDataSource
      .getChallenge()
      .chain((challenge) => signerTask.run(challenge))
      .chain((payload) => lkrpDataSource.authenticate(payload));
  }
}

import {
  type DeviceActionStateMachine,
  type InternalApi,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type AuthenticateDAError,
  type AuthenticateDAInput,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAInternalState,
  type AuthenticateDAOutput,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import {
  LKRPDataSourceError,
  LKRPMissingDataError,
  LKRPTrustchainNotReady,
  LKRPUnauthorizedError,
  LKRPUnknownError,
} from "@api/app-binder/Errors";
import { type Keypair } from "@api/app-binder/LKRPTypes";
import { type JWT } from "@api/index";
import { SignChallengeWithDeviceTask } from "@internal/app-binder/task/SignChallengeWithDeviceTask";
import { SignChallengeWithKeypairTask } from "@internal/app-binder/task/SignChallengeWithKeypairTask";
import {
  type AuthenticationPayload,
  type Challenge,
  type LKRPDataSource,
} from "@internal/lkrp-datasource/data/LKRPDataSource";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { required } from "@internal/utils/required";

import { raiseAndAssign } from "./utils/raiseAndAssign";
import { AddToTrustchainDeviceAction } from "./AddToTrustchainDeviceAction";

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

    const { deviceAuth, keypairAuth, getTrustchain, extractEncryptionKey } =
      this.extractDependencies(internalApi);

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

        getTrustchain: fromPromise(getTrustchain),

        addToTrustchainStateMachine: new AddToTrustchainDeviceAction({
          input: Left(
            new LKRPMissingDataError("Missing input for GetEncryptionKey"),
          ),
        }).makeStateMachine(internalApi),

        extractEncryptionKey: fromPromise(extractEncryptionKey),
      },

      actions: {
        assignErrorFromEvent: raiseAndAssign(
          ({ event }) =>
            Left(
              new LKRPUnknownError(
                String((event as { error?: unknown }).error),
              ),
            ), // NOTE: it should never happen, the error is not typed anymore here
        ),
      },

      guards: {
        hasNoTrustchainId: ({ context }) => !context.input.trustchainId,
        hasNoJwt: ({ context }) => !context.input.jwt,
        isTrustchainMember: ({ context }) =>
          context._internalState
            .toMaybe()
            .map(
              (state) =>
                state.wasAddedToTrustchain ||
                state.applicationStream?.hasMember(
                  context.input.keypair.pubKeyToHex(),
                ),
            )
            .extract() ?? false,
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEECuAXAFmAduglgMYCG6YAImAG5FjKEED2OAdAMLaEDWbATpLgLEANrADEAbQAMAXUSgADo1j4mOeSAAeiAMxSALC30BOHfoDsAJinGAHADYp94wBoQAT0QBaAKwsf9lYBAIzB9jrm5vr6OgC+sW5oWIJEpBTUtPRq7Jw8-BApIuISwXJIIEoqahraCDrBOizG+pb2tq06PlJStvo+bp4IPsZSLBHBprZWnVI+tvGJGNh4qWSUNIR0DPjMOWDcfAIrRZKWZYrKqjvq5bU6lsZGkb0Rsz1TOgOII34+oebGQJmOytBYgJLLAgkNYZTZZa4sADSYHcCmI+F4ELEEGYYBY+BwVEYXDxJNR6MxS2k5wql2qt0Q9miLEsJh8lmewWGrK+Q30wSMOk61k6OjaLTBEJS0PSGy22WR5IxWLAvF4jF4LAUwlIADMNQBbFhktHKqmyDSVK7MGqM+r+Fr6WyA8xM2zBSy86LmJq2Axi-T2YZTQGSpbStLrTLbXaK02UrBiWCoQibWCwamWunXW0IYw+H2BVmWOa2MxScy88xSAXmYJlh5CiYBYxh5IrGVRuEx1hxilYglUET4CCHArHUSZ8pW+mgWrO0b8-kPYyWDkxfS8gujWb2Cb3fmRAxtyGrWXRhUo+MqtUaqcXKo5hl55xNMzBCyzZp9TceRl-FhHCcHo11aKIfBPCMYTleFdi7OgliTFM0wzC1p2zG1nw9fRRmaRwTDXcIuk9P8EEDUZzB0fNLGCOtzB8LpWwScFww7SNYXlBF4JvdVeHvWlH0wudEA-GwjFomsDBsHDPlIj9DFsdkAldZ4WhLSC2Ogi8uI4iEWAAeQUXBkAUBRsVxfFCWJPFGCMnATIUfiZyfYSEHsIMmkiB4PUsCJ3RIwZaMaBouVdFoqJ8Cx5mYqVNPPbtsm4pYDLshyxFVXitR1dB9V4I1bOM0ynIwm5XKZQwGMi3yzHuBsq0eQJehsCZFNdCYNKhdiYJ7FgkqwFLCrM5NUzgVCaWcoStG+MIWArYIDF6BiPzaXkHgq3o2qZSxFLiGLWM6rSEp0mDkqxHEcDxQdrJYAoTqwYrBNKqaEHm0wWHaLoJnMP12nCXl61sFkPymAJulscHAw6s9uJ6vrMBYHiNSyvVDRu3TzXGkrc3mgExmMBoTBGIifFkwZmhYNrqzLejGLsKHO10nqAHEwHQAAVXhUFgdBCEwdEcHMi7LKJEkWBgdnOe53n+Ye60ntqBoAPc4wrHCewaO+gLEHdAVqbaJwwmaXbFnbA74s43YWYlrmeb5gl0tvTVtRRvKxdZjmbelglZdnZ6CYq-MLDMaIpAefpSLrPwehsBxqw9Tp6a67TLfdyXbf5pCRvTH2XL9gI-HoktXv5aTeVMRpJidZ0HgrGxE8Oi3WCtj2pbtgXB2HUd8kKSc0IfOXc3CQHKJ0Z0zHV9oJl5BwKOmesbGLMt6-N2Cm9Tz224d3ic8mhWTEBlpXWaKQxXaepeSDAUgLaEsZnm42WNN6HGeyDh9i4ABJWAAFkwANAAjVU4h8CwAAAQGj-oAvifcBIDywmPQC3RPx6Eos4Um3wVbvX9A8QIPRL7Lxhq-XIX9f4AKAWIEBoCcCMHQOAyBqod7yxEiGCmykGjuiApRMuvkjABFHv5eoJgCEvwRG-bgJD6G8HEBlO8MCJpMJeuBd6Jh1azDDs4C+Stug3xJp9E+wjurZGQBACAbNGAt3Tvbc6l0rKi2MaY8xacvY4EYbmGizoxjemMCMU+oRbD1UaM6J0dg5jxwfrFM2hCET2LMRY5xW8kbOxyqjGJjiN4yzkVjZ8NERizQ9ACVohF6JVgMLNIC3R6glimJYAxydWCpLiZvYaKFXHZL6IDPQYRb4ODFKYMuHkIZ+iIt4qItSjq7AaU4zeMjoGY0em4z8-hwg0Vqg0E+v5Bjg0BmEP4gIzAPGsPYMZjcWAAFFNDoF4MQBgpycCEF4KiNQipM4tMyfM7JE93oAnaFMb6AJ0EvXWf4CswwIishPq6Y5q8zkXKuTcu5DyFBPJRAk2ZWZ3muVaDWFgH5lreL9Ixew-S-AQzrICE+phjxgmoQUeA5QInP0MbneRuY-Q4vmlMQIEwwiOErKRLw+Yxg0VLJEAGYpwn7UZXUvYBxu4Tjpf3X2Cttrsp6Cpbl7kKy8i8D6d0VgTA1lqvmJee0n4MyZbGK8-Yljorga5dkPoR7OnmkGCp4dBjhEeODTVjp2GzChbDdGWBbVKsQA6poq5Vzg1mO6fx-LdXCudN9dyJM6zRRNqec10q4YDXsqZENudagFj8N4g50bQlxsGByAUcwLAxCZOXMwAbEpBvhhCAtu8RIUtVWEPo4ryqrQcIBfWLRfpgWCM2hEzcpn8w7Qoj0DExj0XxSTcqAL8aLlHhYRwTJd1HNNZmpO4zWBiM-j-SRCrYGhpem0A+1gGw0VmH8d12tvFNACNEfMdZgIQQPVBFePVJnpIJHOtxu5ZpRBaiYLyGztZlgprRJNURVFNr-XFKJuxzmXOuegW59zHnXEVKBtpM0Qx7kog4RwHp-pAq6K6fW4rKL6EnbsAAyshUaxHMWuksEK9R312j4xo0KFkBYmQ7JGN0cwLHWCnMdlx56HJ6IshLNtcC3ogz9MMOECwxYnTAn3fEIAA */

      id: "AuthenticateDeviceAction",
      context: ({ input }): types["context"] => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          trustchainId: null,
          jwt: null,
          trustchain: null,
          applicationStream: null,
          encryptionKey: null,
          wasAddedToTrustchain: false,
        }),
      }),

      initial: "CheckCredentials",
      states: {
        CheckCredentials: {
          always: [
            { target: "DeviceAuth", guard: "hasNoTrustchainId" },
            { target: "KeypairAuth", guard: "hasNoJwt" },
            { target: "GetTrustchain" },
          ],
        },

        KeypairAuth: {
          on: {
            success: "GetTrustchain",
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
              actions: raiseAndAssign(({ context, event }) =>
                event.output
                  .map(({ jwt }) => ({ raise: "success", assign: { jwt } }))
                  .mapLeft((error) =>
                    error instanceof LKRPDataSourceError &&
                    error.status === "UNAUTHORIZED"
                      ? new LKRPUnauthorizedError(context.input.trustchainId)
                      : error,
                  ),
              ),
            },
          },
        },

        DeviceAuth: {
          on: { success: "GetTrustchain", error: "Error" },
          initial: "OpenApp",
          states: {
            OpenApp: {
              // TODO snapshot for intermediateValue
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
              entry: assign({
                intermediateValue: {
                  requiredUserInteraction: "connect-ledger-sync",
                },
              }),
              exit: assign({
                intermediateValue: {
                  requiredUserInteraction: UserInteractionRequired.None,
                },
              }),
              invoke: {
                id: "deviceAuth",
                src: "deviceAuth",
                input: ({ context }) => context.input,
                onError: { actions: "assignErrorFromEvent" },
                onDone: {
                  actions: raiseAndAssign(({ event }) =>
                    event.output.chain((payload) =>
                      payload.trustchainId.caseOf({
                        Nothing: () => Left(new LKRPTrustchainNotReady()),
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

        GetTrustchain: {
          on: {
            success: "CheckIsMembers",
            invalidCredentials: "KeypairAuth",
            error: "Error",
          },
          invoke: {
            id: "getTrustchain",
            src: "getTrustchain",
            input: ({ context }) =>
              context._internalState.chain((state) =>
                eitherSeqRecord({
                  lkrpDataSource: context.input.lkrpDataSource,
                  applicationId: context.input.applicationId,
                  trustchainId: () =>
                    required(
                      state.trustchainId ?? context.input.trustchainId,
                      "Missing Trustchain ID in the input for GetTrustchain",
                    ),
                  jwt: () =>
                    required(
                      state.jwt ?? context.input.jwt,
                      "Missing JWT in the input for GetTrustchain",
                    ),
                }),
              ),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(({ trustchain, applicationStream }) => ({
                  raise: "success",
                  assign: { trustchain, applicationStream },
                })),
              ),
            },
          },
        },

        CheckIsMembers: {
          always: [
            { target: "ExtractEncryptionKey", guard: "isTrustchainMember" },
            { target: "AddToTrustchain" },
          ],
        },

        AddToTrustchain: {
          // TODO snapshot for intermediateValue
          on: {
            success: "GetTrustchain",
            error: "Error",
          },
          invoke: {
            id: "AddToTrustchain",
            src: "addToTrustchainStateMachine",
            input: ({ context }) =>
              context._internalState
                .mapLeft(
                  () =>
                    new LKRPMissingDataError(
                      "Missing data in the input for AddToTrustchain",
                    ),
                )
                .chain((state) =>
                  eitherSeqRecord({
                    lkrpDataSource: context.input.lkrpDataSource,
                    keypair: context.input.keypair,
                    clientName: context.input.clientName,
                    permissions: context.input.permissions,
                    jwt: () =>
                      required(
                        state.jwt ?? context.input.jwt,
                        "Missing JWT in the input for AddToTrustchain",
                      ),
                    trustchainId: () =>
                      required(
                        state.trustchainId ?? context.input.trustchainId,
                        "Missing Trustchain ID in the input for GetTrustchain",
                      ),
                    trustchain: () =>
                      required(
                        state.trustchain,
                        "Missing Trustchain in the input for AddToTrustchain",
                      ),
                    applicationStream: () =>
                      required(
                        state.applicationStream,
                        "Missing application stream in the input for AddToTrustchain",
                      ),
                  }),
                ),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(() => ({
                  raise: "success",
                  assign: { wasAddedToTrustchain: true },
                })),
              ),
            },
          },
        },

        ExtractEncryptionKey: {
          on: { success: "Success", error: "Error" },
          invoke: {
            id: "ExtractEncryptionKey",
            src: "extractEncryptionKey",
            input: ({ context }) =>
              context._internalState.chain((state) =>
                required(
                  state.applicationStream,
                  "Missing application stream",
                ).map((applicationStream) => ({
                  applicationStream,
                  keypair: context.input.keypair,
                })),
              ),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map((encryptionKey) => ({
                  raise: "success",
                  assign: { encryptionKey },
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
                state.applicationStream?.getPath().extract(),
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

      getTrustchain: (args: {
        input: Either<
          AuthenticateDAError,
          {
            applicationId: number;
            lkrpDataSource: LKRPDataSource;
            trustchainId: string;
            jwt: JWT;
          }
        >;
      }) =>
        EitherAsync.liftEither(args.input)
          .chain(({ applicationId, lkrpDataSource, trustchainId, jwt }) =>
            lkrpDataSource
              .getTrustchainById(trustchainId, jwt)
              .map((trustchain) => ({
                trustchain,
                applicationStream:
                  trustchain[`m/${applicationId}'`] ??
                  LKRPBlockStream.fromPath(`m/0'/${applicationId}'/0'`),
              })),
          )
          .run(),

      extractEncryptionKey: async (args: {
        input: Either<
          AuthenticateDAError,
          {
            applicationStream: LKRPBlockStream;
            keypair: Keypair;
          }
        >;
      }) => {
        // TODO additional derivations should be supported:
        // https://github.com/LedgerHQ/ledger-live/blob/develop/libs/hw-ledger-key-ring-protocol/src/Device.ts#L216...L226
        // Probably not needed for Ledger Sync
        return Promise.resolve(
          args.input
            .chain(({ applicationStream, keypair }) =>
              applicationStream
                .getPublishedKey(keypair)
                .toEither(
                  new LKRPUnknownError(
                    "There is no encryption key for the current member in the application stream.",
                  ),
                ),
            )
            .map((key) => key.privateKey),
        );
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

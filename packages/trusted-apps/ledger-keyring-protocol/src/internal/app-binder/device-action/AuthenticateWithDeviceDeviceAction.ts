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
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAOutput,
  AuthenticateDAState,
  AuthenticateDAStep,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import {
  LKRPMissingDataError,
  LKRPTrustchainNotReady,
  LKRPUnknownError,
} from "@api/app-binder/Errors";
import { type JWT, type Keypair } from "@api/index";
import { AuthenticateTask } from "@internal/app-binder/task/AuthenticateTask";
import { ExtractEncryptionKeyTask } from "@internal/app-binder/task/ExtractEncryptionKeyTask";
import { SignChallengeWithDeviceTask } from "@internal/app-binder/task/SignChallengeWithDeviceTask";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { required } from "@internal/utils/required";

import {
  type AuthenticateWithDeviceDAInput,
  type AuthenticateWithDeviceDAInternalState,
} from "./models/AuthenticateWithDeviceDeviceActionTypes";
import { raiseAndAssign } from "./utils/raiseAndAssign";
import { AddToTrustchainDeviceAction } from "./AddToTrustchainDeviceAction";

const APP_NAME = "Ledger Sync";

export class AuthenticateWithDeviceDeviceAction extends XStateDeviceAction<
  AuthenticateDAOutput,
  AuthenticateWithDeviceDAInput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue,
  AuthenticateWithDeviceDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    AuthenticateDAOutput,
    AuthenticateWithDeviceDAInput,
    AuthenticateDAError,
    AuthenticateDAIntermediateValue,
    AuthenticateWithDeviceDAInternalState
  > {
    type types = StateMachineTypes<
      AuthenticateDAOutput,
      AuthenticateWithDeviceDAInput,
      AuthenticateDAError,
      AuthenticateDAIntermediateValue,
      AuthenticateWithDeviceDAInternalState
    >;

    const { deviceAuth, getTrustchain, extractEncryptionKey } =
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
        isTrustchainMember: ({ context }) =>
          context._internalState
            .toMaybe()
            .map(
              (state) =>
                state.wasAddedToTrustchain ||
                state.trustchain
                  ?.getAppStream(context.input.appId)
                  .mapOrDefault(
                    (stream) =>
                      stream.hasMember(context.input.keypair.pubKeyToHex()),
                    false,
                  ),
            )
            .extract() ?? false,
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEECuAXAFmAduglgMYCG6YA6vlgCJgBuRYtDhYyhBA9jgHQDyAB1zIBAgMQRuYHvhx1OAa2mchOEQIDaABgC6iUAM6wq+bvpAAPRAEYAzADYeATgAcAFltuntrdYBMAfYANCAAnogA7G6OttYREU5aWgERyQC+aSFoWLgEJGSUNPSMzIzsXLyCwqJiYABOdZx1PAIANqQAZk0Atjwq1Zq65obGFeZWCNbWAKw80-Z+Xvb2ni5OEdPWIeEI9tN+PC720RtuyU52GVkY2HhEpBRUmKWsL2wcppWq6mKwqISsWCwbR6JAgEYmMxgia2FwRHhaCIuaxaLz7ZbTLTBMKIFwuA7JLTePwJVxRCJXEDZW55B6FZ7FV6M94VfjfGr1Rp1EHDIyQnDjRAOA7WPGYiLHaxOab47Y2GVaHheOKiiVOAIBSnU3L3ApPN5vcqfHiGm4SKQyOSKaQQZnUnlgiFjaGIeZuQ62Py+PxSrQucVyhASxyuNzRRKI3wrLU3HX5R5FFhMO0fbgmu1mzlNFrtdBdOq9W1J+1DR1852gCbTTE8WyuWFReyIhJbHG7CK2OaxPx4tz+bzTGM5O7x+kGlOs01YX7-QHA0sGcufQVB7w8FYk6XS6YRaxuaaB9WKwlraJe+z4txDmm6hMMpOG1O8KeYWoNJoOxejZcuoMJBH2FEdbVlM+5uIGMyxOuixaJi0wOLY0xXpkVKxiOdL6syj6sgA4mA6AACp1KgsDoIQmDELI5o4NIsjyEoPAwIRxGkeRlE4J+4JLlClaIOsLg8I2sE+CqTYuIGLios47jRLCe7rL415xhhiYlBOxp4cxJFkRRVFZs0bSdD0jH4UR2lsbInFOj+vEIOs1jrru+IbBcWJrIGu4OfBdjKtKorWEp6F6qpTLFk+PCaWZrG6TgM4AnA86gl+-Irv4YbQWiGpNmSh4XnMCz7P5vhgYFtLBfealhbhpksTp7FvlyVncQKv5TPiCKwU2iKLIkfgQW4ErOOSThhiiixuC4pW3mOWHqWmADC2CEAoACSsAALJgN0ABG9SwGITXfjxljyhNzj7n48G2J6+J+oe8Q8AE6r7vYTgFR2U2jphD5zbwi1gMta2bTte0HdYSVcUdLW2TMSKCZ4N3TL1SHYjs-h4jwUqgXWCwUih2pBXe45VcayAQBABGcFFdVUZINGWvR0hkxTVO1RZHELpDKWtUcswokhiIyv5tgQV6IoXlEqL+j6TifSpFWhWU4XM5T1Psw12aGXmxkq6z5kxYd3Mw7zgkdnWEQ9k4VthhBUyKvYe62Kk5w+D2cvlcTSusrrasxXFc6GxWJ0ID6r3OH4iFhscZywf1UpKgs1gO2sF51u7ROzSTaY+2zfv6YHNnB6H8KIcS6oW69cIQddnaJ5JhLddG+NoWVGc-VnvAAKIWOgdTEBwnc4IQdShAIFQANJgKE1G0VaDHd73-foIPw+jxPU8F8dEyijW7gSqinhaA44Ftv6tdEk7l37DuH3N8Orcze3XvGgvfcD0PI9j58k-T-pOZGQWHgr8l4r0-uvUIm9obBx3l5GY8wUQOzrNKDyTZMbwIuNKdwb106P0qs-NMwD36ry-twH+-sEqQJXKHJw4dI7RDDEkfY913TrHVDKDwCwr44O+ng1gRoCE9zfsvD+a9v5Tw1tyTm1kt6IGLrWJGnpy5+Ern1NsKIzjriOHvJGfZ1QZBQjgTgtp4BggJg-Hhis+FPl5FDFcABaVsOx5izGPhbUayJYiDjvjeL6IVkwdzZAMGxRtg4DQkuleIRJUTHB6kSbhfjsLGhfMEoOVYUSYxVPMBYPhOoST2EqJ2MphQXlgn4eJCt-H4N4JFXO7EUmFwmBcRwgFRQDQWE2ECh4j4FI2EiDwA0kYBW8cpD2mcqk8H+oDDaW1dp1BMclVJNgHDwmWDHWEb0PDqlyjQrEV8BrrD8E08pnsrHe3JqrWpsh6kyMmPEBypdrpiVcHsauSRoJxDWHYREMxJrDMJrgyxLIX6CJASIkhOAf7XKgdvO58jvAOD9M8g8bZpQEgKt5aIex-THLGac40ABlWcCUoVUNiJ2RYGx5gBD7E2CI91OwW2eohAI1YJo4qfnigh746gkt-AESSj1E5JAri4bs1dPS1l3EifYcJYI7n0WkIAA */

      id: "AuthenticateWithDeviceDeviceAction",
      context: ({ input }): types["context"] => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          trustchainId: null,
          jwt: null,
          trustchain: null,
          encryptionKey: null,
          wasAddedToTrustchain: false,
        }),
      }),

      initial: "OpenApp",
      states: {
        OpenApp: {
          on: { success: "DeviceAuth", error: "Error" },
          invoke: {
            id: "openApp",
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) => ({
                  step: AuthenticateDAStep.OpenApp,
                  ...event.snapshot.context.intermediateValue,
                }),
              }),
            },
            input: { appName: APP_NAME },
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(() => ({ raise: "success" })),
              ),
            },
          },
        },

        DeviceAuth: {
          entry: assign({
            intermediateValue: {
              step: AuthenticateDAStep.Authenticate,
              requiredUserInteraction: AuthenticateDAState.Authenticate,
            },
          }),
          on: { success: "GetTrustchain", error: "Error" },
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

        GetTrustchain: {
          entry: assign({
            intermediateValue: {
              step: AuthenticateDAStep.GetTrustchain,
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          on: { success: "CheckIsMembers", error: "Error" },
          invoke: {
            id: "getTrustchain",
            src: "getTrustchain",
            input: ({ context }) =>
              context._internalState.chain((state) =>
                eitherSeqRecord({
                  lkrpDataSource: context.input.lkrpDataSource,
                  trustchainId: () =>
                    required(
                      state.trustchainId,
                      "Missing Trustchain ID for GetTrustchain",
                    ),
                  jwt: () =>
                    required(state.jwt, "Missing JWT for GetTrustchain"),
                }),
              ),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map((trustchain) => ({
                  raise: "success",
                  assign: { trustchain },
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
          on: {
            success: "GetTrustchain",
            error: "Error",
          },
          invoke: {
            id: "AddToTrustchain",
            src: "addToTrustchainStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
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
                      required(state.jwt, "Missing JWT for AddToTrustchain"),
                    appId: context.input.appId,
                    trustchain: () =>
                      required(
                        state.trustchain,
                        "Missing Trustchain for AddToTrustchain",
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
          entry: assign({
            intermediateValue: {
              step: AuthenticateDAStep.ExtractEncryptionKey,
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          on: { success: "Success", error: "Error" },
          invoke: {
            id: "ExtractEncryptionKey",
            src: "extractEncryptionKey",
            input: ({ context }) => ({
              keypair: context.input.keypair,
              stream: context._internalState.chain(({ trustchain }) =>
                required(
                  trustchain?.getAppStream(context.input.appId).extract(),
                  "Missing application stream for ExtractEncryptionKey",
                ),
              ),
            }),
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
                state.trustchainId,
                "Missing Trustchain ID in the output",
              ),
            jwt: () => required(state.jwt, "Missing JWT in the output"),
            applicationPath: () =>
              required(
                state.trustchain
                  ?.getAppStream(context.input.appId)
                  .chain((stream) => stream.getPath())
                  .extract(),
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
    const authentication = new AuthenticateTask();
    const encryptionKeyExtraction = new ExtractEncryptionKeyTask();

    return {
      deviceAuth: ({ input }: { input: AuthenticateWithDeviceDAInput }) =>
        authentication.run(
          input.lkrpDataSource,
          new SignChallengeWithDeviceTask(internalApi),
        ),

      getTrustchain: (args: {
        input: Either<
          AuthenticateDAError,
          {
            lkrpDataSource: LKRPDataSource;
            trustchainId: string;
            jwt: JWT;
          }
        >;
      }) =>
        EitherAsync.liftEither(args.input)
          .chain(({ lkrpDataSource, trustchainId, jwt }) =>
            lkrpDataSource.getTrustchainById(trustchainId, jwt),
          )
          .run(),

      extractEncryptionKey: async ({
        input,
      }: {
        input: {
          keypair: Keypair;
          stream: Either<AuthenticateDAError, LKRPBlockStream>;
        };
      }) =>
        EitherAsync.liftEither(input.stream).chain((stream) =>
          encryptionKeyExtraction.run(input.keypair, stream),
        ),
    };
  }
}

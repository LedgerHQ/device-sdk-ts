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
      /** @xstate-layout N4IgpgJg5mDOIC5QEECuAXAFmAduglgMYCG6YAImAG5FjKEED2OAdAPIAOuyHHAxBGZgW+HFUYBrYYy44eHANoAGALqJQHRrHxMc6kAA9EARgDMANhYBOABwAWUwHYATKeMBWG8+N3nAGhAAT0RHUysWG2NHc3dY0zt3YysAX2SAtCxcAhIyShpCOgZ8ZnZZeT4wACdKxkqWDgAbUgAzWoBbFhluXmU1JBBNbV19IwRjDxZ3c2c7Kynzc0clG3MbAOCEcztLCzs7GxslRKUt51T0jGw8IlIKalp6XVLu-lhUQgLYWF79QZ1ivT9UamGyOFhKRyRJTOGxWJSmZzuRzrRCg9yTZwQxxWPbTYznEAZK7ZW55B5FEqcF4Vaq1H79P7DIGIEFgiFQmFwhFIlEISIsWZWKzYpYxUFWcwEolZG65e4FR4AlhkhWXARCERiSTCCDyuiXekaLT-ZgjRBTOwRBFKaHjRG+cy8xyJCJRBY2EHxRaOKWXGU5O75QpPFX6rA0mp1RotdosXVBomGgbGpmgUaxJQsMIe4XTcxOD28sVZrbuEHOZxWUymX2Za4B0OKkqNtVvD5wb6qX4pgFmhDY0wsfPORwuD3uJRRfxBRBWCssYyg-ZhKsxFJpQl++ukvVN1gt8NVSNJxm95n9qtDhGjmGmCdT3mY5wsGZCoXxHHLmsb6XbuUJilWAAcTAdAABVKlQWB0EITBiFEdUcGEURxCkFgYHAyDoNg+CcBPHtTXPYUbBYRxtmMGEYXMHxq15SJ0UiaI9gojwEW-C46xJf9ySeEDMKgmC4IQo9anqJp0FaSoOgwiCBJw0R8KGM801nRxjCHNS5zseFZgo6cNhcZ9djsaJ80OUd2M3TjZUDHilT42TsKEnA+DbT5Oz6I0lMIlSxhmS1pgnBxNL2fTZ3ccJYU8aEnB8EdJR-LcuNshVAJYBysME3CIzpLsGQIwFfPGD1wTvCi4UnasHF5NiBTfSIFkrKwfFrYkbMbNKAGFsEICQAElYAAWTANoACMqlgPhFJNQrDBMdx9msBIQXfZwthcXkJRIqYZmdStzCOGFWv9HcAKebqwF6gbhrGiapuMTzk282bRg8RacTLWEqzWkyws2RZrBOSsbDicZLN-ZKOqeZAIAgMDGEcrKEMEJDNVQ4QYbhhHMvkvC8q8ma+0XGIFyOaZsUWDwzF5MswUxNw3ASIVYTORLrIbXc0sx+HEdxnKo3EySOm57G5Oc6bUzmsYVnRCyItBcxbCiXk9kHMihXzXMyz2dxjr-FLgyVEXeec1z3nciXlKl7wvCHRE1vsBwFjsGrhQiTEkjIzFtlWXW2bajmzqN2GeZx02RMqS2fOt4wAbvCUzESL6nCLbEIjsO0lCFGFYhsPXIc5p4AFEDHQSpiAYIucEISpAg4XQAGkwECRDkK1NCS7Liv0Crmu68b5uo5ekwQczexIR1mJF0nOiyyHLPTBOXwPAOPP-ZO7jUuL0vy8r6va-rgEm5biOxJjKSWE73ee-3-uj8H-GnsJ89FxdRJPAqn61hnfsDoXHaDiIgWtCNeHEA6nTsiUK+3de4HwHi3NyHYh59m8HHCKn0Vjwgii7H+xgbTqWFM1RIZgYRL3zu1QuSpoF7z7ofZgx9+bIPPKgsE8cMEHXjjgjYcx1ImS5GpA4CQKKpA3DgRgup4D9AhhQoO0dTzR1GAAWmMLyRRlgbQ2gcHeaszUQaInIYHSBrAqRyF4N2Z6fYTJ0RBC+JYXhF5RGFCCAxECt5KgPJgcxz9fLHAXFEfxi8willnpmEcEJbC0wOmWFxm9DYlAymLXCXjJajGapYSmoIQajicaYTaPhbHLHGAdWYoJ8Tr31lDJUF0rpDRGuNSokiCYpJMBYMEzsIT7HhNEO8m0-5hCRCONSI4qxlLARvA2e4WDGzDkk-KFiX6jnUmwhwMVYTQiLHeIcO1bA4niHsGJEy0rUJvrQ+BySravUWVmdBKzXBrL+nMZ8QMTJhCOEoJ2BzKklAAMrmw7OchRiBXA2izBExWn5VgqNwfgl8lYfCxw8M6ewnzKFQNpJUAFw8EDAszNmKYQpcSRBqvOV8wpvBMwcHYERyQgA */

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
          encryptionKey: null,
          wasAddedToTrustchain: false,
        }),
      }),

      initial: "OpenApp",
      states: {
        OpenApp: {
          // TODO snapshot for intermediateValue
          on: { success: "DeviceAuth", error: "Error" },
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

        DeviceAuth: {
          on: { success: "GetTrustchain", error: "Error" },
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

        GetTrustchain: {
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

import {
  type DeviceActionStateMachine,
  hexaStringToBuffer,
  type InternalApi,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type AddToLedgerKeyRingProtocolDAError,
  type AddToLedgerKeyRingProtocolDAInput,
  type AddToLedgerKeyRingProtocolDAIntermediateValue,
  type AddToLedgerKeyRingProtocolDAInternalState,
  type AddToLedgerKeyRingProtocolDAOutput,
  AddToLedgerKeyRingProtocolDAState,
  AddToLedgerKeyRingProtocoleDAStep,
} from "@api/app-binder/AddToLedgerKeyRingProtocolDeviceActionTypes";
import { type CryptoService } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import {
  LKRPLedgerKeyRingProtocolNotReady,
  LKRPUnknownError,
} from "@api/model/Errors";
import { InitTask } from "@internal/app-binder/task/InitTask";
import {
  ParseStreamToDeviceTask,
  type ParseStreamToDeviceTaskInput,
} from "@internal/app-binder/task/ParseStreamToDeviceTask";
import {
  SignBlockTask,
  type SignBlockTaskInput,
} from "@internal/app-binder/task/SignBlockTask";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { required } from "@internal/utils/required";

import { raiseAndAssign } from "./utils/raiseAndAssign";

export class AddToLedgerKeyRingProtocolDeviceAction extends XStateDeviceAction<
  AddToLedgerKeyRingProtocolDAOutput,
  AddToLedgerKeyRingProtocolDAInput,
  AddToLedgerKeyRingProtocolDAError,
  AddToLedgerKeyRingProtocolDAIntermediateValue,
  AddToLedgerKeyRingProtocolDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    AddToLedgerKeyRingProtocolDAOutput,
    AddToLedgerKeyRingProtocolDAInput,
    AddToLedgerKeyRingProtocolDAError,
    AddToLedgerKeyRingProtocolDAIntermediateValue,
    AddToLedgerKeyRingProtocolDAInternalState
  > {
    type types = StateMachineTypes<
      AddToLedgerKeyRingProtocolDAOutput,
      AddToLedgerKeyRingProtocolDAInput,
      AddToLedgerKeyRingProtocolDAError,
      AddToLedgerKeyRingProtocolDAIntermediateValue,
      AddToLedgerKeyRingProtocolDAInternalState
    >;

    const { initCommand, parseStream, signBlock } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        initCommand: fromPromise(initCommand),
        parseStream: fromPromise(parseStream),
        signBlock: fromPromise(signBlock),
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
        isTustchainEmpty: ({ context }) =>
          context.input
            .toMaybe()
            .chain((input) =>
              input.LedgerKeyRingProtocol.getAppStream(input.appId),
            )
            .chain((appStream) => appStream.parse().toMaybe())
            .map((blocks) => blocks.length === 0)
            .orDefault(true),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEEIQCoHt0CcCusALgMYAWAhgJYB2AImAG6XFjLGGWbUB0AktZUIBlOLE7UAxBC5huNBpgDWsmoIDCmALaby1CAG0ADAF1EoAA6YxHLmZAAPRAEZDAdm6unAFgAcXpwBsAKwAzL7+TgA0IACezq4AnB6GIU4ATAFeaUEBuT5pAL4F0agY2PhEZFR0jMys7OJ8AsKi4hJgODiYONzmADbkhABm3ZpyzRraugYmdpbW4naOCAlJaS4JXgGpCZ6r0XEIPgHc2YaGXiEhOdlXTkUlaFi4BCQUNPRMLGw2PPyCIlgYi4ElgeGILCBRlMSBA80Ei1hy2uXm4IVcXlWZwS5xChiCB0QaQSQW4QVcxMC63SCTShWKIFKzwqb2qnzqP0a-xaQLaHS6OGhcysCNsSMQKLRGKxQUMOJS+MJKzlaPSXlcPkSPkMaQxD0ZT3KryqH1q3waXG4AAVyDhYGAhIQcGByJopDJxgplL1bfbHc7XULYfDfktEKETgEnJ4coZMkEsUqnNqySFgtGgsmsWkvPqmUbKu8al96r9rb6HU6XW7+d1egNhqMfXbKwHNEGLCLQ+KEEEMmTdvHXEFjj4-ErNdxDD4wviciT8gEfHnDS9C2yzaXGjaW-7q6DwZDYB24V3EaBlq4NR4wmnpylvCEfEriScvHHdX4cwF1gEV2U11ZU0S05S0dz9KtXXaTpuhPENzwcRArx8G9LgCe9UkuZ9YiQscyR-LwEwCDVzice4GXzQCTWLDkLR4NRSDAYhFGQcx+mYQZxD3V0AFF7EoIgJDgs8xQvZxozSU4NnxK5sl2KIcIQYlJLSEIFx8Mj0PVcjHgAllqPZc0ywYpiWLYvoON+bjND4gTCCEpwYU7BZRMQhAyIpKS5RkkI5M8JUo1JeN8hHVwdQCBI-wo1d9KLQyt0tfNbKIGgoGs91qBUagvVkMQoGoAAhPpMGY4SXOoMN3KyFC3AfBN0jpLwlUxFDrgSdEwoTTVEn-ZljTizdQJ4JL+JS6g0sgmsYJ6fpBhGHAxjywritK2ZgxEiqe28aduCyZMlzTA7NWai5uBxH90xcLYZ16gsgJoozGhGuzUvSsEIVEMrRU2sT3MyJxTkinxIqvNJRzSALvFOSl1QTdYKSi3S+vXYDaLLZ6xomttoIFL7u1+wJ-EBpcQYpcGAsyDxKXnPs6QSW6qIGkC6O4fMADkwAAd3S6RMs9JRcsofKipKxQ8YQ5ZvDBqcwtSeq6RzJMMTO0JvGB3zfOnBnYo3Zn0cNDnucmnG61mxsFu4JaRdWpzT3KyrtpQvbR0OmdjsUjSyXOc4NJ1BInFp7X+t1tGnoNrm3sPT61uc76Hf+4ngeIsmlwhxTiUMbh8mJJ9PESLZAiDlGHoS4bw6N7Ha0FGO7bjraE9fJPQfJxSwgB3zKX9hJtTjIIigZahMAgOA7EonXUce1z4Nc5YAFoFMOWfSVWVZNXnVxtm8Eki-u+KhqaAFWinjbKvVF9rwDi6KSCWUKVzaK9ODifS-LXdJuFe2e3Vdx-HfBMtnRLSNOhxPxnSTucEcfh8TLgfsjXeg0WYmWYqxdixBOJcGsslQgH866-RxADK8Vxu7dXahFF8kUzofkxEELwWxsg3x3gZBB+syhYNeu-dan8CboidivXYCYUiZFcEqIiWc1TA3OLSTU98kZ3SYXrMOZRDbWRwfjNyTgeG7T4cOHEaYz7p1cCEXaH50JjmjHiNMjCmah0tEIKOQJVES3iLsKcN9fCqU-JcAkiltJkllvkQxtV1gyINI-Yue8WY8Wmo4me8RMy7RzFSK6cZ0gUyMeqf2tDpxpnJH3fuQA */

      id: "AddToLedgerKeyRingProtocolDeviceAction",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          sessionKeypair: null,
        }),
      }),

      initial: "InitSession",
      states: {
        InitSession: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: AddToLedgerKeyRingProtocoleDAStep.Initialize,
            },
          }),
          on: { success: "ParseStream", error: "Error" },
          invoke: {
            id: "initCommand",
            src: "initCommand",
            input: ({ context }) =>
              context.input.map((input) => input.cryptoService),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map((sessionKeypair) => ({
                  raise: "success",
                  assign: { sessionKeypair },
                })),
              ),
            },
          },
        },

        ParseStream: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: AddToLedgerKeyRingProtocoleDAStep.ParseStream,
            },
          }),
          on: { success: "CheckApplicationStreamExist", error: "Error" },
          invoke: {
            id: "parseStream",
            src: "parseStream",
            input: ({ context }) =>
              context.input.chain((input) =>
                eitherSeqRecord({
                  seedBlock: () =>
                    required(
                      input.LedgerKeyRingProtocol.getRootStream()
                        .chain((stream) => stream.parse().toMaybe())
                        .extract()?.[0],
                      "Missing seed block to parse",
                    ),
                  applicationStream: () =>
                    required(
                      input.LedgerKeyRingProtocol.getAppStream(
                        input.appId,
                      ).extract(),
                      "Missing application stream to parse",
                    ),
                }),
              ),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(() => ({ raise: "success" })),
              ),
            },
          },
        },

        CheckApplicationStreamExist: {
          always: [
            { target: "AddToNewStream", guard: "isTustchainEmpty" },
            { target: "AddToExistingStream" },
          ],
        },

        AddToExistingStream: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction:
                AddToLedgerKeyRingProtocolDAState.AddMember,
              step: AddToLedgerKeyRingProtocoleDAStep.AddMember,
            },
          }),
          on: { success: "Success", error: "Error" },
          invoke: {
            id: "signBlock",
            src: "signBlock",
            input: ({ context }) =>
              context.input.chain((input) => {
                const appStream = input.LedgerKeyRingProtocol.getAppStream(
                  input.appId,
                );
                return eitherSeqRecord({
                  cryptoService: input.cryptoService,
                  lkrpDataSource: input.lkrpDataSource,
                  LedgerKeyRingProtocolId: input.LedgerKeyRingProtocol.getId(),
                  jwt: input.jwt,
                  clientName: input.clientName,
                  sessionKeypair: () =>
                    context._internalState.chain(({ sessionKeypair }) =>
                      required(sessionKeypair, "Missing session keyPair"),
                    ),
                  path: () =>
                    required(
                      appStream.chain((stream) => stream.getPath()).extract(),
                      "Missing application path",
                    ),
                  parent: () =>
                    required(
                      appStream
                        .chain((stream) => stream.parse().toMaybe())
                        .chainNullable((blocks) => blocks.at(-1)?.hash())
                        .chainNullable(hexaStringToBuffer)
                        .extract(),
                      "Missing parent block",
                    ),
                  blockFlow: {
                    type: "addMember",
                    data: {
                      name: input.clientName,
                      publicKey: input.keyPair.getPublicKey(),
                      permissions: input.permissions,
                    },
                  },
                });
              }),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(() => ({ raise: "success" })),
              ),
            },
          },
        },
        AddToNewStream: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction:
                AddToLedgerKeyRingProtocolDAState.AddMember,
              step: AddToLedgerKeyRingProtocoleDAStep.AddMember,
            },
          }),
          on: { success: "Success", error: "Error" },
          invoke: {
            id: "signBlock",
            src: "signBlock",
            input: ({ context }) =>
              context.input.chain((input) =>
                eitherSeqRecord({
                  lkrpDataSource: input.lkrpDataSource,
                  LedgerKeyRingProtocolId: input.LedgerKeyRingProtocol.getId(),
                  jwt: input.jwt,
                  clientName: input.clientName,
                  sessionKeypair: () =>
                    context._internalState.chain(({ sessionKeypair }) =>
                      required(sessionKeypair, "Missing session keyPair"),
                    ),
                  path: `m/0'/${input.appId}'/0'`,
                  parent: () =>
                    required(
                      input.LedgerKeyRingProtocol.getRootStream()
                        .chain((stream) => stream.parse().toMaybe())
                        .chainNullable((blocks) => blocks[0]?.hash())
                        .chainNullable(hexaStringToBuffer)
                        .extract(),
                      "Missing init block",
                    ),
                  blockFlow: {
                    type: "derive",
                    data: {
                      name: input.clientName,
                      publicKey: input.keyPair.getPublicKey(),
                      permissions: input.permissions,
                    },
                  },
                }).chain(() => Left(new LKRPLedgerKeyRingProtocolNotReady())),
              ),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map(() => ({ raise: "success" })),
              ),
            },
          },
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) => context._internalState.map((_) => undefined),
    });
  }

  extractDependencies(internalApi: InternalApi) {
    return {
      initCommand: async (args: {
        input: Either<AddToLedgerKeyRingProtocolDAError, CryptoService>;
      }): Promise<Either<AddToLedgerKeyRingProtocolDAError, KeyPair>> =>
        EitherAsync.liftEither(args.input)
          .chain((cryptoService) =>
            new InitTask(internalApi, cryptoService).run(),
          )
          .run(),

      parseStream: async (args: {
        input: Either<
          AddToLedgerKeyRingProtocolDAError,
          ParseStreamToDeviceTaskInput
        >;
      }) =>
        EitherAsync.liftEither(args.input)
          .chain<AddToLedgerKeyRingProtocolDAError, unknown>((input) =>
            new ParseStreamToDeviceTask(internalApi).run(input),
          )
          .run(),

      signBlock: (args: {
        input: Either<
          AddToLedgerKeyRingProtocolDAError,
          SignBlockTaskInput & { cryptoService: CryptoService }
        >;
      }): Promise<Either<AddToLedgerKeyRingProtocolDAError, void>> =>
        EitherAsync.liftEither(args.input)
          .chain((input) =>
            new SignBlockTask(internalApi, input.cryptoService).run(input),
          )
          .run(),
    };
  }
}

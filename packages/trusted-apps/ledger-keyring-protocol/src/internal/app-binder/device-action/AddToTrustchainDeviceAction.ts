import {
  type DeviceActionStateMachine,
  hexaStringToBuffer,
  type InternalApi,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type AddToTrustchainDAError,
  type AddToTrustchainDAInput,
  type AddToTrustchainDAIntermediateValue,
  type AddToTrustchainDAInternalState,
  type AddToTrustchainDAOutput,
} from "@api/app-binder/AddToTrustchainDeviceActionTypes";
import { type Keypair } from "@api/index";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { InitTask } from "@internal/app-binder/task/InitTask";
import {
  ParseStreamToDeviceTask,
  type ParseStreamToDeviceTaskInput,
} from "@internal/app-binder/task/ParseStreamToDeviceTask";
import {
  type SignBlockError,
  SignBlockTask,
  type SignBlockTaskInput,
} from "@internal/app-binder/task/SignBlockTask";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { required } from "@internal/utils/required";

import { raiseAndAssign } from "./utils/raiseAndAssign";

export class AddToTrustchainDeviceAction extends XStateDeviceAction<
  AddToTrustchainDAOutput,
  AddToTrustchainDAInput,
  AddToTrustchainDAError,
  AddToTrustchainDAIntermediateValue,
  AddToTrustchainDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    AddToTrustchainDAOutput,
    AddToTrustchainDAInput,
    AddToTrustchainDAError,
    AddToTrustchainDAIntermediateValue,
    AddToTrustchainDAInternalState
  > {
    type types = StateMachineTypes<
      AddToTrustchainDAOutput,
      AddToTrustchainDAInput,
      AddToTrustchainDAError,
      AddToTrustchainDAIntermediateValue,
      AddToTrustchainDAInternalState
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
              new UnknownDAError(String((event as { error?: unknown }).error)),
            ), // NOTE: it should never happen, the error is not typed anymore here
        ),
      },

      guards: {
        isTustchainEmpty: ({ context }) =>
          context.input
            .toMaybe()
            .chain((input) => input.applicationStream.parse().toMaybe())
            .map((blocks) => blocks.length === 0)
            .orDefault(true),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEEIQCoHt0CcCusALgMYAWAhgJYB2AImAG6XFjLGGWbUB0AktZUIBlOLE7UAxBC5huNBpgDWsmoIDCmALaby1CAG0ADAF1EoAA6YxHLmZAAPRAEZDAdm6unAFgAcAJi9PLwA2PycAVmCAGhAAT0QAZhDucJDXAE5XcO9wsOCAX3yY1AxsfCIyKjpGZlZ2cT4BYVFxCTAcHEwcbnMAG3JCADMuzTkmjW1dAxM7S2txO0cEdPTuMMN0hKcEnycMwx9ouMQ-cITuDYTg1wOb4PScwuK0LFwCEgoaeiYWNhsefiCESwMRcCSwPDEFggoymJAgOaCBbwpYJVLcBKuLwrQx+dJnbZeGLxBAJALcLxOYLhHGGFx+BJPEAlV7lD5Vb61P4NQHNEGtdqdHCw2ZWJG2FGJdGY7HpXH4rZJYmIXx+NaywKbBk3VyMorMl5ld6VL41X71LjcAAK5BwsDAQkIODA5E0UhkYwUyh6tvtjudrpF8MR-0WiDOwW4wT2ex8CTJ122yoQYR8FzSPkyEWyXiuTJZRoqn2qPzq-2tvodTpdbsFXR6-SGIx9dqrAc0QYsYtDkoQuUjNNcwUC4V2up8yac5JpV2CCTcVJ8XgZ+cNbyLHLNZYaNtb-pr4Mh0NgnYR3eRoCWrlcad1udcpxWu0xyb8fkM3CpwWCBzlSR8o5eKupTruypqltylq7n61aum0HRdKeIYXg4iDXreSSYo+6TPq4yZoucWIrF4dLxlcaLAayxrFpy5rlmopBgMQijIOYfTMAM4j7q6ACi9iUEQEhIeeEqXs4VJeCkN5+D4D4-ocESvm+3APNSP6+GSETpAU+oFqBJollyFo8AxTEsWxvQcf83GaHxAmEEJThwl28yiahCBOE4hwYoYvi+D4dIHLiyYALRTu4bh4mcN43psAGUYWYGGXRDQFnZRA0FANnutQKjUF6shiFA1AAEK9JgzHCa51Bhh5XjLtwAWBIYwQARJU6hXikm5CEnleOEWSUk4CX6TRW6QTwaX8Rl1BZbBtYId0fQDMMOCjEVpXlZVMzBiJNW9t4DKfpEpy7JEmbaaFOxqgk6Tvp5A1-vVerPCBbIGbR26WlN9mZdlEJQqIVXivtYkecOapZD4sleYYhgDd+nUZBSlKpNDWG5CN71jRBxncD9M1ze28FCsDPZg1S4ThBc773IE843IpxwIGFBweLdGyyZhByyVj1Gbrj5YFgAcmAADu2XSLlnpKIVlDFWVFWKGTKFLIdkZDjs2ZtS+zOYh4NxwxkAXpNicZ8xu4FGULhqixL80k-Wy1Nmt3AbYr23OWe1W1d4ewYps0ZTpsmxZKFvhrOEdLXg8LgtbdFtJZ9E347b4v-UeQM7S5IO+xDHijtpgR+PciPM94kZuLieK3XiRvpInH3jXjIvpw7dbCtn3u5wd1LU7iLWm7qVdMySYSSZSpzeDsngl1OhT6tQmAQHAdh6djAvWyhyFuUsYXh-cjUPE+ThxW+w26WuG9Wyllq8sCoKg935PuYEyb1ZJKwrAEERxtkWSNxxlvKClYbKih9r2QI7hKQkSjhsM4pt8JUgpF-KkaJNj1XCIAzet8TKMWYqxdixBOJcBsulQg4Ce5gzlE4A2mEGRPlNgkJSH5vx9xuNiOGYRXDYJvl9SahpyF-XmpQl+atMSRm2KmNwAFUhlxJCFd85x4yjnHpPQIvheHJX4anUodswG7QgRTK4qxoyGB2GbN8qZJzkgeLsH80ZNjw2hlo5OeMhCZxBKI1Wzg4yrBajSe6A1erhE6gFKMDwBrbHxP1O8rjm7lh4otbxu9fEDRSFqUcUNIgHFCi4VYOE5Q4RahsRcOlChAA */

      id: "AddToTrustchainDeviceAction",
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
          on: { success: "ParseStream", error: "Error" },
          invoke: {
            id: "initCommand",
            src: "initCommand",
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
          on: { success: "CheckApplicationStreamExist", error: "Error" },
          invoke: {
            id: "parseStream",
            src: "parseStream",
            input: ({ context }) =>
              context.input.chain((input) =>
                required(input.trustchain?.["m/"], "Missing root stream")
                  .chain((rootStream) => rootStream.parse())
                  .chain((blocks) => required(blocks[0], "Missing seed block"))
                  .map((seedBlock) => ({
                    seedBlock,
                    applicationStream: input.applicationStream,
                  })),
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
          on: { success: "Success", error: "Error" },
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: "add-ledger-sync",
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signBlock",
            src: "signBlock",
            input: ({ context }) =>
              context.input.chain((input) =>
                eitherSeqRecord({
                  lkrpDataSource: input.lkrpDataSource,
                  trustchainId: input.trustchainId,
                  jwt: input.jwt,
                  clientName: input.clientName,
                  sessionKeypair: () =>
                    context._internalState.chain(({ sessionKeypair }) =>
                      required(sessionKeypair, "Missing session keypair"),
                    ),
                  path: () =>
                    required(
                      input.applicationStream.getPath().extract(),
                      "Missing application path",
                    ),
                  parent: () =>
                    required(
                      input.applicationStream
                        .parse()
                        .toMaybe()
                        .chainNullable((blocks) => blocks.at(-1)?.hash())
                        .chainNullable(hexaStringToBuffer)
                        .extract(),
                      "Missing parent block",
                    ),
                  blockFlow: {
                    type: "addMember",
                    data: {
                      name: input.clientName,
                      publicKey: input.keypair.pubKeyToU8a(),
                      permissions: input.permissions,
                    },
                  },
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

        AddToNewStream: {
          on: { success: "Success", error: "Error" },
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: "add-ledger-sync",
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signBlock",
            src: "signBlock",
            input: ({ context }) =>
              context.input.chain((input) =>
                eitherSeqRecord({
                  lkrpDataSource: input.lkrpDataSource,
                  trustchainId: input.trustchainId,
                  jwt: input.jwt,
                  clientName: input.clientName,
                  sessionKeypair: () =>
                    context._internalState.chain(({ sessionKeypair }) =>
                      required(sessionKeypair, "Missing session keypair"),
                    ),
                  path: () =>
                    required(
                      input.applicationStream.getPath().extract(),
                      "Missing application path",
                    ),
                  parent: () =>
                    required(
                      Maybe.fromNullable(input.trustchain["m/"])
                        .chain((rootStream) => rootStream.parse().toMaybe())
                        .chainNullable((blocks) => blocks[0]?.hash())
                        .chainNullable(hexaStringToBuffer)
                        .extract(),
                      "Missing init block",
                    ),
                  blockFlow: {
                    type: "derive",
                    data: {
                      name: input.clientName,
                      publicKey: input.keypair.pubKeyToU8a(),
                      permissions: input.permissions,
                    },
                  },
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

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) => context._internalState.map((_) => undefined),
    });
  }

  extractDependencies(internalApi: InternalApi) {
    return {
      initCommand: (): Promise<Either<LKRPDeviceCommandError, Keypair>> =>
        new InitTask(internalApi).run(),

      parseStream: async (args: {
        input: Either<AddToTrustchainDAError, ParseStreamToDeviceTaskInput>;
      }) =>
        EitherAsync.liftEither(args.input)
          .chain<AddToTrustchainDAError, unknown>((input) =>
            new ParseStreamToDeviceTask(internalApi).run(input),
          )
          .run(),

      signBlock: (args: {
        input: Either<AddToTrustchainDAError, SignBlockTaskInput>;
      }): Promise<Either<SignBlockError, void>> =>
        EitherAsync.liftEither(args.input)
          .chain((input) => new SignBlockTask(internalApi).run(input))
          .run(),
    };
  }
}

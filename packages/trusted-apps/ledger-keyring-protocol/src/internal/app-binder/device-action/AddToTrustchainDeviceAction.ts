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
  type AddToTrustchainDAError,
  type AddToTrustchainDAInput,
  type AddToTrustchainDAIntermediateValue,
  type AddToTrustchainDAInternalState,
  type AddToTrustchainDAOutput,
} from "@api/app-binder/AddToTrustchainDeviceActionTypes";
import {
  LKRPTrustchainNotReady,
  LKRPUnknownError,
} from "@api/app-binder/Errors";
import { type Keypair } from "@api/index";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
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
            .chain((input) => input.trustchain.getAppStream(input.appId))
            .chain((appStream) => appStream.parse().toMaybe())
            .map((blocks) => blocks.length === 0)
            .orDefault(true),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEEIQCoHt0CcCusALgMYAWAhgJYB2AImAG6XFjLGGWbUB0AktZUIBlOLE7UAxBC5huNBpgDWsmoIDCmALaby1CAG0ADAF1EoAA6YxHLmZAAPRAEZDAdm6unAFgAcAJi9PLwA2PycAVmCAGhAAT0QAZhDucJDXAE5XcO9wsOCAX3yY1AxsfCIyKjpGZlZ2cT4BYVFxCTAcHEwcbnMAG3JCADMuzTkmjW1dAxM7S2txO0cEdPTuMMN0hKcEnycMwx9ouMQ-cITuDYTg1wOb4PScwuK0LFwCEgoaeiYWNhsefiCESwMRcCSwPDEFggoymJAgOaCBbwpZJVbBYLZMJeQJ+HwPGLxBAJM4eLwrLyGbYJK5JcJPEAlV7lD5Vb61P4NQHNEGtdqdHCw2ZWJG2FGJVLcBKucnpQx+dJnbZeQmIXx+NaywKbPzStwJBlMsrvSpfGq-epcbgABXIOFgYCEhBwYHImikMjGCmUPTtDqdLrdQvhiP+i0QZ2C3GCez2Phpfmu21VCDCPguaXxnnC2S8V0NL2NFU+1R+dX+Nr9judrvd-K6PX6QxGvvt1cDmmDFhFYfFCFyUfCmWCgXCu1cOxTTgCKU2GISbicwR8Xl1BdKb2LbPN5YatrbAdr4Mh0NgXYRPeRoCWrlc6YnedcpxWu2lKb8fkM3CXGIOcqSPhjl467MiaJbshaFb7v6NZum0HRdOeoZXg4iC3veSTSs+6Svq4KYkucMoUlSNK0vSRSMoWm6smaZaclaaikGAxCKMg5h9MwAziIeboAKL2JQRASEhl5itezhLl4KR3niT7BAcMbhO+H7cA8mLyb4CRhEOBQUUa1GmqWHKWjwjHMax7G9Jx-w8Zo-GCYQwlOHC3bzGJqEIE4TiHFKhi+L4PhUgc8opgAtNO7huAqZx3nemyASBRY0UZkENEa9lEDQUC2R61AqNQ3qyGIUDUAAQr0mAsSJbnUOGnk4hqgWBIYy7ZCO05hQqUm5CEXleOEWReF5iUGeBO70Tw6UCZl1DZbBdYId0fQDMMOCjMVZUVVVMwhqJtV9t4urfpEpy7JE+LpEcRKhTsGoJOkn5eQN-44gaelUSyhkQbuVpTQ5WU5RCUKiNVor7eJnkjhqWQ+D4niBYYA0Yp1GTcDiEQBVhuQjZ9Y10SZ3B-TNc0dvBAqg72ENLjmFyfvcgQLjcERhS4GFyjhD4LrDrg42B274xWRoAHJgAA7jl0h5V6ShFZQJXlZVigUyhSyHVGrjBDsERjtkb7HMS7i3oYxsZIF6TkvGvNbrRxmC4WIvi-NZMNstzZrdwG0K9tLkXjVdXeHsUpzl5Cr3dKSn66FvhrOEVK3g8LgtfdVvJd9E2E-bYuAyeIM7a5YP+1DHhjpduL3Mj+veFGbjyqHD1ym46Qp1940E8LWdO-Wgp577BcHZi4S0y15sTjXzP69iaPTrmOyeIm06FBR1CYBAcB2PpuP87bKHIe5SzhWFISrPij2M4YAEjs3ePb1a3LAqC4O95THmBCmOJSSsKwBBE8bZFkV9b1SlaaC7ZazCj9n2QI7ghqUljhsM45t8JLjRp-JcJJNg4nIs8Dcm8bZANMkxFibEOLEC4lwWyGVCDgL7hDOUTgPCc11C+c2CRlJfgxAPG45JjZhB5u9HBfM8E-UmoWShAN5rUOfqraUUZthpjcIBVIFdrqfnODSMc2IhoBBlD4ABQj07t0dh2SRKtnBXHRC4HYFsPxpinDOB4ux5Ixk2IjWGeiUrCO4EIHOIITF72cLebq3kbj+BakOFUkc8TsIeEjKKWQwjuLTgTXii0-GP1Vv4ehklKSUkRojPCkcXCrBwg8Z89xAr4l0YvIAA */

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
                eitherSeqRecord({
                  seedBlock: () =>
                    required(
                      input.trustchain
                        .getRootStream()
                        .chain((stream) => stream.parse().toMaybe())
                        .extract()?.[0],
                      "Missing seed block to parse",
                    ),
                  applicationStream: () =>
                    required(
                      input.trustchain.getAppStream(input.appId).extract(),
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
              context.input.chain((input) => {
                const appStream = input.trustchain.getAppStream(input.appId);
                return eitherSeqRecord({
                  lkrpDataSource: input.lkrpDataSource,
                  trustchainId: input.trustchain.getId(),
                  jwt: input.jwt,
                  clientName: input.clientName,
                  sessionKeypair: () =>
                    context._internalState.chain(({ sessionKeypair }) =>
                      required(sessionKeypair, "Missing session keypair"),
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
                      publicKey: input.keypair.pubKeyToU8a(),
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
                  trustchainId: input.trustchain.getId(),
                  jwt: input.jwt,
                  clientName: input.clientName,
                  sessionKeypair: () =>
                    context._internalState.chain(({ sessionKeypair }) =>
                      required(sessionKeypair, "Missing session keypair"),
                    ),
                  path: `m/0'/${input.appId}'/0'`,
                  parent: () =>
                    required(
                      input.trustchain
                        .getRootStream()
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
                      publicKey: input.keypair.pubKeyToU8a(),
                      permissions: input.permissions,
                    },
                  },
                }).chain(() => Left(new LKRPTrustchainNotReady())),
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
      }): Promise<Either<AddToTrustchainDAError, void>> =>
        EitherAsync.liftEither(args.input)
          .chain((input) => new SignBlockTask(internalApi).run(input))
          .run(),
    };
  }
}

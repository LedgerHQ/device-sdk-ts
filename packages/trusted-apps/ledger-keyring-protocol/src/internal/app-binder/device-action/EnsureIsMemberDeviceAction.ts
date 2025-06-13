import {
  type DeviceActionStateMachine,
  type InternalApi,
  MissingDataDAError,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, Just, Left, Maybe, Nothing, Right } from "purify-ts";
import { assign, fromPromise, raise, setup } from "xstate";

import {
  type EnsureIsMemberDAError,
  type EnsureIsMemberDAInput,
  type EnsureIsMemberDAIntermediateValue,
  type EnsureIsMemberDAInternalState,
  type EnsureIsMemberDAOutput,
} from "@api/app-binder/EnsureIsMemberDeviceActionTypes";
import {
  type Block,
  type KeyPair,
  type Trustchain,
} from "@api/app-binder/LKRPTypes";
import { type JWT } from "@api/app-binder/LKRPTypes";

import { continueAction } from "./utils/continueAction";
import { requiredToEither, requiredToMaybe } from "./utils/required";

type DependencyData<T> = Either<EnsureIsMemberDAError, T>;

const APP_NAME = "Ledger Sync";

export class EnsureIsMemberDeviceAction extends XStateDeviceAction<
  EnsureIsMemberDAOutput,
  EnsureIsMemberDAInput,
  EnsureIsMemberDAError,
  EnsureIsMemberDAIntermediateValue,
  EnsureIsMemberDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    EnsureIsMemberDAOutput,
    EnsureIsMemberDAInput,
    EnsureIsMemberDAError,
    EnsureIsMemberDAIntermediateValue,
    EnsureIsMemberDAInternalState
  > {
    type types = StateMachineTypes<
      EnsureIsMemberDAOutput,
      EnsureIsMemberDAInput,
      EnsureIsMemberDAError,
      EnsureIsMemberDAIntermediateValue,
      EnsureIsMemberDAInternalState
    >;

    const {
      getTrustchain,
      getApplicationPath,
      listMembers,
      callInitApdu,
      parseStream,
      signBlock,
      putBlock,
      postBlock,
    } = this.extractDependencies(internalApi);

    const required = requiredToEither(MissingDataDAError);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        getTrustchain: fromPromise(getTrustchain),
        openApp: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),

        callInitApdu: fromPromise(callInitApdu),
        parseStream: fromPromise(parseStream),
        signBlock: fromPromise(signBlock),
        putBlock: fromPromise(putBlock),
        postBlock: fromPromise(postBlock),
      },

      actions: {
        continue: continueAction(),
        assignErrorFromErrorEvent: assign({
          _internalState: (_): EnsureIsMemberDAInternalState =>
            Left(
              (_.event as unknown as { error: EnsureIsMemberDAError }).error,
            ), // NOTE: it should never happen, the error is not typed anymore here
        }),
      },
    }).createMachine({
      id: "EnsureIsMemberDeviceAction",
      initial: "InitialState",

      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          applicationPath: Nothing,
          encryptionKey: Nothing,
          trustchain: Nothing,
          shouldDerive: Nothing,
          signedBlock: Nothing,
        }),
      }),

      states: {
        InitialState: {
          always: "GetTrustchain",
        },

        GetTrustchain: {
          on: { success: "StoreApplicationPath", error: "Error" },
          invoke: {
            id: "getTrustchain",
            src: "getTrustchain",
            input: () => required({ jwt: this.input.jwt }),
            onError: { actions: "assignErrorFromErrorEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map((trustchain) => ({
                    type: "success",
                    state: { trustchain: Just(trustchain) },
                  })),
              },
            },
          },
        },

        StoreApplicationPath: {
          on: { success: "CheckIsMembers", error: "Error" },
          entry: {
            type: "continue",
            params: ({ context }) =>
              context._internalState
                .chain((s) =>
                  required({
                    applicationId: this.input.applicationId,
                    trustchain: s.trustchain,
                  }),
                )
                .chain(getApplicationPath)
                .map((applicationPath) => ({
                  type: "success",
                  state: { applicationPath: Just(applicationPath) },
                })),
          },
        },

        CheckIsMembers: {
          on: {
            "is member": "ExtractEncryptionKey",
            "is not member": "CallInitApdu",
          },
          entry: raise(({ context }) => {
            const publicKey = Array.from(this.input.keypair.pub)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            const input = context._internalState.toMaybe().chain((_) =>
              requiredToMaybe({
                trustchain: _.trustchain,
                applicationPath: _.applicationPath,
              }),
            );

            const isMember = input
              .map(listMembers)
              .map((members) =>
                members.some((m) => m.publicKey === `0x${publicKey}`),
              )
              .orDefault(false);

            return { type: isMember ? "is member" : "is not member" };
          }),
        },

        OpenApp: {
          on: { success: "CallInitApdu", error: "Error" },
          invoke: {
            id: "openApp",
            src: "openApp",
            input: { appName: APP_NAME },
            onError: { actions: "assignErrorFromErrorEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map(() => ({ type: "success" })),
              },
            },
          },
        },

        CallInitApdu: {
          on: { success: "ParseStream", error: "Error" },
          invoke: {
            id: "callInitApdu",
            src: "callInitApdu",
            input: ({ context }) =>
              context._internalState.chain((state) =>
                required({ trustchain: state.trustchain }),
              ),
            onError: { actions: "assignErrorFromErrorEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map(() => ({ type: "success" })),
              },
            },
          },
        },

        ParseStream: {
          on: { success: "CheckApplicationBlocks", error: "Error" },
          invoke: {
            id: "parseStream",
            src: "parseStream",
            input: ({ context }) =>
              context._internalState.chain((state) =>
                required({
                  trustchain: state.trustchain,
                  applicationPath: state.applicationPath,
                }),
              ),
            onError: { actions: "assignErrorFromErrorEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map(() => ({ type: "success" })),
              },
            },
          },
        },

        CheckApplicationBlocks: {
          on: { next: "SignBlock" },
          entry: {
            type: "continue",
            params: ({ context }) =>
              context._internalState.map((state) => {
                const input = requiredToMaybe({
                  applicationPath: state.applicationPath,
                });
                const shouldDerive = input
                  .chainNullable(({ applicationPath }) => {
                    const path = applicationPath.split("/").slice(1);
                    return path.reduce(
                      (tree, key) => tree?.children.get(key),
                      state.trustchain.extract()?.root,
                    );
                  })
                  .map((appNode) => appNode.blocks.length === 0)
                  .alt(Just(true));

                return { type: "next", state: { shouldDerive } };
              }),
          },
        },

        SignBlock: {
          on: { success: "CheckWasDerived", error: "Error" },
          invoke: {
            id: "signBlock",
            src: "signBlock",
            input: ({ context }) =>
              context._internalState.chain((_) =>
                required({
                  keypair: context.input.keypair,
                  trustchain: _.trustchain,
                  shouldDerive: _.shouldDerive,
                }),
              ),
            onError: { actions: "assignErrorFromErrorEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map((result) => ({
                    type: "was derived",
                    state: {
                      trustchain: Just(result.trustchain),
                      signedBlock: Just(result.block),
                    },
                  })),
              },
            },
          },
        },

        CheckWasDerived: {
          on: {
            "was derived": "PostBlock",
            "was not derived": "PutBlock",
          },
          entry: raise(({ context }) => ({
            type: context._internalState
              .toMaybe()
              .chain((s) => s.shouldDerive)
              .orDefault(true)
              ? "was derived"
              : "was not derived",
          })),
        },

        PutBlock: {
          on: { success: "ExtractEncryptionKey", error: "Error" },
          invoke: {
            id: "putBlock",
            src: "putBlock",
            input: ({ context }) =>
              context._internalState.chain((_) =>
                required({ block: _.signedBlock, jwt: context.input.jwt }),
              ),
            onError: { actions: "assignErrorFromErrorEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map(() => ({ type: "success" })),
              },
            },
          },
        },

        PostBlock: {
          on: { success: "ExtractEncryptionKey", error: "Error" },
          invoke: {
            id: "postBlock",
            src: "postBlock",
            input: ({ context }) =>
              context._internalState.chain((_) =>
                required({ block: _.signedBlock, jwt: context.input.jwt }),
              ),
            onError: { actions: "assignErrorFromErrorEvent", target: "Error" },
            onDone: {
              actions: {
                type: "continue",
                params: ({ event }) =>
                  event.output.map(() => ({ type: "success" })),
              },
            },
          },
        },

        ExtractEncryptionKey: {
          on: { success: "Success", error: "Error" },
          entry: {
            type: "continue",
            params: ({ context }) => {
              const block = context._internalState.chain((s) =>
                s.signedBlock
                  .alt(s.trustchain.chainNullable((t) => t.root.blocks[0])) // TODO find the correct block
                  .toEither(new MissingDataDAError("Block is missing")),
              );

              const publishKeyEvent = block.chain((b) =>
                Maybe.fromNullable(
                  b.commands.find(({ type }) => type === "PublishKey"),
                ).toEither(
                  new MissingDataDAError("PublishKey event is missing"),
                ),
              );

              return publishKeyEvent.map((_) => ({
                type: "success",
                state: { encryptionKey: Just(new Uint8Array()) }, // TODO: Extract the encryption key from the block
              }));
            },
          },
        },

        Success: { type: "final" },

        Error: { type: "final" },
      },

      output: ({ context }) =>
        context._internalState.chain((state) =>
          required({
            applicationPath: state.applicationPath,
            encryptionKey: state.encryptionKey,
          }),
        ),
    });
  }

  extractDependencies(_internalApi: InternalApi) {
    return {
      getTrustchain: (_: {
        input: DependencyData<{ jwt: JWT }>;
      }): Promise<DependencyData<Trustchain>> =>
        Promise.resolve(Right({} as Trustchain)), // TODO

      getApplicationPath,

      listMembers,

      callInitApdu: (): Promise<Either<EnsureIsMemberDAError, void>> =>
        Promise.resolve(Right(undefined)), // TODO

      parseStream: (_: {
        input: DependencyData<{
          trustchain: Trustchain;
          applicationPath: string;
        }>;
      }): Promise<DependencyData<void>> => Promise.resolve(Right(undefined)), // TODO

      signBlock: (_: {
        input: DependencyData<{
          trustchain: Trustchain;
          keypair: KeyPair;
          shouldDerive: boolean;
        }>;
      }): Promise<DependencyData<{ trustchain: Trustchain; block: Block }>> =>
        Promise.resolve(Right({} as { trustchain: Trustchain; block: Block })), // TODO

      putBlock: (_: {
        input: DependencyData<{ block: Block; jwt: JWT }>;
      }): Promise<DependencyData<unknown>> =>
        Promise.resolve(Right({} as unknown)), // TODO

      postBlock: (_: {
        input: DependencyData<{ block: Block; jwt: JWT }>;
      }): Promise<DependencyData<unknown>> =>
        Promise.resolve(Right({} as { block: Block; jwt: JWT })), // TODO
    };

    function getApplicationPath(input: {
      applicationId: number;
      trustchain: Trustchain;
    }): DependencyData<string> {
      const appNode = input.trustchain.root.children
        .get("0h")
        ?.children.get(`${input.applicationId}h`)?.children;

      if (!appNode) {
        return Left(new UnknownDAError("No nodes found for application ID"));
      }

      const indexes = Array.from(appNode.keys()).map((key) =>
        Number(key.replace("h", "")),
      );

      return Right(`m/0h/${input.applicationId}h/${Math.max(0, ...indexes)}h`);
    }

    function listMembers(_: {
      trustchain: Trustchain;
      applicationPath: string;
    }): { publicKey: string }[] {
      return []; // TODO: Implement member listing logic
    }
  }
}

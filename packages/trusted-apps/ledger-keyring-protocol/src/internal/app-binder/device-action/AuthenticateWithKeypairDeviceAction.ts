import {
  type DeviceActionStateMachine,
  type ExecuteDeviceActionReturnType,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Right } from "purify-ts";
import { fromPromise, setup } from "xstate";

import {
  type AuthenticateDAError,
  type AuthenticateDAIntermediateValue,
  type AuthenticateDAOutput,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import {
  LKRPDataSourceError,
  LKRPUnauthorizedError,
  LKRPUnknownError,
} from "@api/app-binder/Errors";
import { type JWT, type Keypair } from "@api/index";
import { AuthenticateTask } from "@internal/app-binder/task/AuthenticateTask";
import { ExtractEncryptionKeyTask } from "@internal/app-binder/task/ExtractEncryptionKeyTask";
import { SignChallengeWithKeypairTask } from "@internal/app-binder/task/SignChallengeWithKeypairTask";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { required } from "@internal/utils/required";

import {
  type AuthenticateWithKeypairDAInput,
  type AuthenticateWithKeypairDAInternalState,
} from "./models/AuthenticateWithKeypairDeviceActionTypes";
import { raiseAndAssign } from "./utils/raiseAndAssign";

export class AuthenticateWithKeypairDeviceAction extends XStateDeviceAction<
  AuthenticateDAOutput,
  AuthenticateWithKeypairDAInput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue,
  AuthenticateWithKeypairDAInternalState
> {
  execute(): ExecuteDeviceActionReturnType<
    AuthenticateDAOutput,
    AuthenticateDAError,
    AuthenticateDAIntermediateValue
  > {
    const stateMachine = this.makeStateMachine();
    return this._subscribeToStateMachine(stateMachine);
  }

  makeStateMachine(): DeviceActionStateMachine<
    AuthenticateDAOutput,
    AuthenticateWithKeypairDAInput,
    AuthenticateDAError,
    AuthenticateDAIntermediateValue,
    AuthenticateWithKeypairDAInternalState
  > {
    type types = StateMachineTypes<
      AuthenticateDAOutput,
      AuthenticateWithKeypairDAInput,
      AuthenticateDAError,
      AuthenticateDAIntermediateValue,
      AuthenticateWithKeypairDAInternalState
    >;

    const { keypairAuth, getTrustchain, extractEncryptionKey } =
      this.extractDependencies();

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        keypairAuth: fromPromise(keypairAuth),
        getTrustchain: fromPromise(getTrustchain),
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
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEECuAXAFmAduglgMYCG6YAImAG5FjKEED2OAdANJgCeADsfgE5osAYgjMwLfDiqMA1hPk8+gjJgDaABgC6iUN0ax8THLpAAPRAEYNAVhYAOAMwB2AEzOAnDfuvXHy+4ANCCcVk4svgBsGjGWACyRNkkazgC+qcFC2HhEpBTUtPTG7Fy8AlnCYPz8jPws3AA2pABmtQC2LIplKliaOkgg+obGphYIHq4s0T42kfEeHo6uls7BoQj2kSxxrpHOm64aPnFxXumZqrgEJGSUNIR0DPjMJUrlqsKwqIQPsLB9piGRmeJgGY0ccXsU3sNncKS8jkiuzWiD8cRYliSrm8GmicWclhh5xAWSuuVuBQeRRBr26FSqNX4AIGQJGYMQEKhkRhcM8NkRyJCiBsHg0LA89lOhOcjg8nkhxNJORu+Xuj2KAHEwOgACr8VCwdCETB8HCicSSaRyCQwXX6w3G03MvQGYHMUbCuJilwiywS9y+DQeFEIQno2yLRwQzz2WNLRWXZV5O6FJ4vLV2g1Gk1SSrVWr1JroVr8Dq2vVZx1SZ2DV1s0BjfmOFgaSzWL1LXEJRwh+zOCLRNteOKY-auBNYMkqlNUtOsDMVh05s1fH5wf7aQF1kEejYxFgyiaOWYrGEaVwhtHi2P85ytyIuXwT7LXZOU9U0hf27OmvOMmusju7J7mKh6uMecz7DY54hgkHjbCcbbeL6cqSs+U5vmq1IvAAomY6D8MQDA4TghD8DwxgcJw5o4BIUgyPILB4QRRHoCRZEUSCVEAdu7rAdY1gsEkXhtkcSJ9j2QqhvsEQLH6-gPsJRzoUmFJYXOTH4YRxGkeR3CUVwf4Fo0LTtJpLE6Rx+lcVwPHDEBDZWK2lgRDYpyOBokIpM4BK9i5pwLBK9h+tEBKRCpr5qamxTMdpbG6ZxzBUZ83y-Bu-QuvZfGOaGUbwdihLQacbhenEl5eA4ywTPi7iWI4RIZCSiaRaq0U0rFrHsXpBnUQytR2W6oI5XVsquYVnlyq4pUhtG4oaBCywyhCkQrXE6SNTgjAQHAphKi1M4ftltZZUN5iIAAtJYIbneFjV7eSrWzsUVF0qoW4nbu+KXjCLbYssXqSpssIRQ9B3YfO2qLj+UjvYNn3OHYCMrAE7j1biUbfXYMIwviI7BRKSQg9O77g+ZcVdYlOBUbD9ZneM7gOLY9geAkuLnkk31ikGTgLNBSOWETmFtS8ADKqXrjTDl0-EK0sI4hJ+H6CPciO5V2OetiRF682LK2gtRU97X5vwktHWMMtbPLPj+HKsySldUkJFyOz2EGNh1Ts4HrakQA */

      id: "AuthenticateDeviceAction",
      context: ({ input }): types["context"] => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          jwt: null,
          trustchain: null,
          encryptionKey: null,
        }),
      }),

      initial: "KeypairAuth",
      states: {
        KeypairAuth: {
          on: { success: "GetTrustchain", error: "Error" },
          invoke: {
            id: "keypairAuth",
            src: "keypairAuth",
            input: ({ context }) => context.input,
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

        GetTrustchain: {
          on: { success: "ExtractEncryptionKey", error: "Error" },
          invoke: {
            id: "getTrustchain",
            src: "getTrustchain",
            input: ({ context }) => ({
              lkrpDataSource: context.input.lkrpDataSource,
              trustchainId: context.input.trustchainId,
              jwt: context._internalState.chain(({ jwt }) =>
                required(jwt, "Missing JWT for GetTrustchain"),
              ),
            }),
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
            trustchainId: context.input.trustchainId,
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

  extractDependencies() {
    const authentication = new AuthenticateTask();
    const encryptionKeyExtraction = new ExtractEncryptionKeyTask();

    return {
      keypairAuth: ({ input }: { input: AuthenticateWithKeypairDAInput }) =>
        authentication.run(
          input.lkrpDataSource,
          new SignChallengeWithKeypairTask(input.keypair, input.trustchainId),
        ),

      getTrustchain: ({
        input,
      }: {
        input: {
          lkrpDataSource: LKRPDataSource;
          trustchainId: string;
          jwt: Either<AuthenticateDAError, JWT>;
        };
      }) =>
        EitherAsync.liftEither(input.jwt)
          .chain((jwt) =>
            input.lkrpDataSource.getTrustchainById(input.trustchainId, jwt),
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

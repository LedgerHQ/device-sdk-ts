import {
  type DeviceActionStateMachine,
  type ExecuteDeviceActionReturnType,
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
  AuthenticateDAStep,
} from "@api/app-binder/AuthenticateDeviceActionTypes";
import { type CryptoService } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import {
  LKRPDataSourceError,
  LKRPUnauthorizedError,
  LKRPUnknownError,
} from "@api/model/Errors";
import { type JWT } from "@api/model/JWT";
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

    const { keyPairAuth, getLedgerKeyRingProtocol, extractEncryptionKey } =
      this.extractDependencies();

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        keyPairAuth: fromPromise(keyPairAuth),
        getLedgerKeyRingProtocol: fromPromise(getLedgerKeyRingProtocol),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QEECuAXAFmAduglgMYCG6YA6vlgNJgCeADsfgE4AiYAbkWMoQQHscAOlqNmLNFgDEEIWGH4cnAQGsF68aymYA2gAYAuolAMBsKviEmQAD0QBGfQFZhADgDMAdgBMXh24AbG7Ozl4ePgA0IHSOnsI+PoEuzg4ALACcGT4BAL650Tq4BCRklDT0TKwc3IS8-FYiYlWSGJjSYCwsAizCDAA2pABmPQC2wpotOgbGSCBmFoI4NvYI2cLJbj4eAZnpgWlRMYhBwofByV6BHmke2V75hW3FRKQUVJjNEjU8fEuilQkOmksFQhDqsFgMxsC0s1jmqxubg2IT8XmcGQxaQcDkC0ViCA8+g8wgcXi89y8+jcGWCPjSjxARTwrzKHy+1S4vwaQgBWlaMk63RY0LmsKWK0QSJRzjRGKxOLxxwQgVxwkxGSJaWcHhuHmcDIKTOeLNK7wq-J+dT+jWEAHEwOgACosVCwdCETDMHCyeSKZRqBQwZ2u92e72i0zmOHLBGIA36YTeDG0hx+BzOQJHAm7YQuTVZfTorxpTJuRnMkpvcqfQGc2r1f4OkNuj1epQdLo9PqDdAjFjjYMu1vhpSR+bRiVxhA6kn6HEZ0vOfQXfEnLwJZI+fRpYLZLPaismqtsi0tK2N23N4dh9s+0HguBQowwyeNSUINz6RPhTXakJpG4JZroSO55jiSROIcRIZkeWAvGaNYcuwXLWjyIjXqGbbep2wrjuK77Tl+P53DczgAUBaQgZkrjYiEZLXJikFwdgprVuydYoQ2Nq8gAorY6AsMQ-C8TghAsIwSxiL6OAKEoKjqMI-GCcJ6CieJkmNGI+FvvCoCrE4TjCKEGSZNutKeJ4IFksiPhZIksqpIqO4sQh7Fnt8qGXnxAlCSJYkSQwUn0Lh3YDMMYxKb5qnqYFwV0DpiyEfpjjzg4CQGjStypG4pZeCBbjpcu35EkEu66rKrlsaetaWl5PEiMpflqQFmlCNJD4Qs+sxRklel2I4uoZBlATeHZma6iBWruEupnJtcgEPEalasuatXnvV6FRSp-kaUFWkhUKPSJTGH4OENI2eL4mLXB4U2ZuqkHBLiZH6s4+RGjgAgQHANgrYhHF1dx6Gvn1sYpQgAC0DggZDrhZAjiNIx4VUnmtyEXg1fJTG0oOndOaT5cqPghHmPiyjRHgHDuKPLceq1IZxmNbZhI53njU4Q4TrjomSVymdi5UgSTrghCEf5Zok6K0088HVejTObf8TUxa1+3tfQHPJQNax+O4Li5bKxJFtkwtfnmGS5Q4tLJpbYSowzgMbcD-wAMpgl1Wv9QZu6BEmo1UwcHiWdmUpgTTOS0vompkjLxpy2jjNA9yytdiwXvgzr+x+zsniB7cIfUaZGxkmSu7LoEXhfkt+RAA */

      id: "AuthenticateWithKeypairDeviceAction",
      context: ({ input }): types["context"] => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: Right({
          jwt: null,
          LedgerKeyRingProtocol: null,
          encryptionKey: null,
        }),
      }),

      initial: "KeypairAuth",
      states: {
        KeypairAuth: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: AuthenticateDAStep.Authenticate,
            },
          }),
          on: { success: "GetLedgerKeyRingProtocol", error: "Error" },
          invoke: {
            id: "keyPairAuth",
            src: "keyPairAuth",
            input: ({ context }) => context.input,
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ context, event }) =>
                event.output
                  .map(({ jwt }) => ({ raise: "success", assign: { jwt } }))
                  .mapLeft((error) =>
                    error instanceof LKRPDataSourceError &&
                    error.status === "UNAUTHORIZED"
                      ? new LKRPUnauthorizedError(context.input.LedgerKeyRingProtocolId)
                      : error,
                  ),
              ),
            },
          },
        },

        GetLedgerKeyRingProtocol: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: AuthenticateDAStep.GetLedgerKeyRingProtocol,
            },
          }),
          on: { success: "ExtractEncryptionKey", error: "Error" },
          invoke: {
            id: "getLedgerKeyRingProtocol",
            src: "getLedgerKeyRingProtocol",
            input: ({ context }) => ({
              lkrpDataSource: context.input.lkrpDataSource,
              LedgerKeyRingProtocolId: context.input.LedgerKeyRingProtocolId,
              jwt: context._internalState.chain(({ jwt }) =>
                required(jwt, "Missing JWT for GetLedgerKeyRingProtocol"),
              ),
            }),
            onError: { actions: "assignErrorFromEvent" },
            onDone: {
              actions: raiseAndAssign(({ event }) =>
                event.output.map((LedgerKeyRingProtocol) => ({
                  raise: "success",
                  assign: { LedgerKeyRingProtocol },
                })),
              ),
            },
          },
        },

        ExtractEncryptionKey: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: AuthenticateDAStep.ExtractEncryptionKey,
            },
          }),
          on: { success: "Success", error: "Error" },
          invoke: {
            id: "ExtractEncryptionKey",
            src: "extractEncryptionKey",
            input: ({ context }) => ({
              cryptoService: context.input.cryptoService,
              keyPair: context.input.keyPair,
              stream: context._internalState.chain(({ LedgerKeyRingProtocol }) =>
                required(
                  LedgerKeyRingProtocol?.getAppStream(context.input.appId).extract(),
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
            LedgerKeyRingProtocolId: context.input.LedgerKeyRingProtocolId,
            jwt: () => required(state.jwt, "Missing JWT in the output"),
            applicationPath: () =>
              required(
                state.LedgerKeyRingProtocol
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
      keyPairAuth: ({ input }: { input: AuthenticateWithKeypairDAInput }) =>
        authentication.run(
          input.lkrpDataSource,
          new SignChallengeWithKeypairTask(
            input.cryptoService,
            input.keyPair,
            input.LedgerKeyRingProtocolId,
          ),
        ),

      getLedgerKeyRingProtocol: ({
        input,
      }: {
        input: {
          lkrpDataSource: LKRPDataSource;
          LedgerKeyRingProtocolId: string;
          jwt: Either<AuthenticateDAError, JWT>;
        };
      }) =>
        EitherAsync.liftEither(input.jwt)
          .chain((jwt) =>
            input.lkrpDataSource.getLedgerKeyRingProtocolById(input.LedgerKeyRingProtocolId, jwt),
          )
          .run(),

      extractEncryptionKey: async ({
        input,
      }: {
        input: {
          cryptoService: CryptoService;
          keyPair: KeyPair;
          stream: Either<AuthenticateDAError, LKRPBlockStream>;
        };
      }) =>
        EitherAsync.liftEither(input.stream).chain((stream) =>
          encryptionKeyExtraction.run(
            input.cryptoService,
            input.keyPair,
            stream,
          ),
        ),
    };
  }
}

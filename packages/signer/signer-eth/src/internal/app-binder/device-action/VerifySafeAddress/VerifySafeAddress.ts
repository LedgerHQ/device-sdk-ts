import { type ClearSignContextSuccess } from "@ledgerhq/context-module";
import {
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type VerifySafeAddressDAError,
  type VerifySafeAddressDAInput,
  type VerifySafeAddressDAIntermediateValue,
  type VerifySafeAddressDAInternalState,
  type VerifySafeAddressDAOutput,
  VerifySafeAddressDAStep,
} from "@api/app-binder/VerifySafeAddressDeviceActionTypes";
import {
  BuildSafeAddressContextTask,
  type BuildSafeAddressContextTaskArgs,
  type BuildSafeAddressContextTaskResult,
} from "@internal/app-binder/task/BuildSafeAddressContextTask";
import { ProvideContextTask } from "@internal/app-binder/task/ProvideContextTask";

export type MachineDependencies = {
  readonly buildSafeAddressContexts: (arg0: {
    input: BuildSafeAddressContextTaskArgs;
  }) => Promise<BuildSafeAddressContextTaskResult>;
  readonly provideContexts: (arg0: {
    input: {
      contexts: ClearSignContextSuccess[];
    };
  }) => Promise<Either<VerifySafeAddressDAError, void>>;
};

export class VerifySafeAddressDeviceAction extends XStateDeviceAction<
  VerifySafeAddressDAOutput,
  VerifySafeAddressDAInput,
  VerifySafeAddressDAError,
  VerifySafeAddressDAIntermediateValue,
  VerifySafeAddressDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    VerifySafeAddressDAOutput,
    VerifySafeAddressDAInput,
    VerifySafeAddressDAError,
    VerifySafeAddressDAIntermediateValue,
    VerifySafeAddressDAInternalState
  > {
    type types = StateMachineTypes<
      VerifySafeAddressDAOutput,
      VerifySafeAddressDAInput,
      VerifySafeAddressDAError,
      VerifySafeAddressDAIntermediateValue,
      VerifySafeAddressDAInternalState
    >;

    const { buildSafeAddressContexts, provideContexts } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "Ethereum" },
        }).makeStateMachine(internalApi),
        buildSafeAddressContexts: fromPromise(buildSafeAddressContexts),
        provideContexts: fromPromise(provideContexts),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => !!context.input.options.skipOpenApp,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EARgDsAZg4AOACzGAnAFYDNgGxXpF6ToA0IAJ67TOgEwcDHTsLCz9pQN9bAF8o9zRMXAIiNipaBiZWcipuXn4hETEpHXkkEGVVLIwNbQR9IzNLG3tHZzdPXV87aQ5I5ztfSON+zpi49Gx8QhJKtMYWFM4AeUUwDGZFRVmMhfEIKjAOVAw6CgBrA4oVtY3hUTAAWRIACyOwGRKlFTUqasQ9RxMVjMdgcdj0xnBvncXlqkTsHAsQxcnVMvmM4TsoxA8QmSWm7C280qHAAwk8wMRTstVutNvQ5pl2AAlOAAVwEpCkcg05W+VVKNR0gW6IOsoWMfgMdmhHRBHActisFnMMqCmNi2PGiSmC0JjOyZIpVKutINCxZsHZnMkxR5X0qv1qwsVwRVOglcJlcoQEo4ns9pmkQL00mCFgMWJxuuSM3p22JAHEwKRaSSqAAzdC7faHY5nA4wNMbDMYbNQd4OirqAW6CVWDhWPR2fR2Yy+Fu+UwGX1C4zGHoGcPSDuGCx6HTRnWTOMEhNE9gcFMlxRliviMA4HAUHAcRQCUSZ3cAWw4xfTWfQVdKvKdddqDabLbbY/6Pb7IQ4I+sPdR1n+KMtRjWd8VSBdDU4FdL3LdArRtY1KS5D4ykdWtQBqAYO2-MFwyBHRTEjNoYT8Lpv3CKwrG7Zt0VMPRpwSUD9QghZl1TGCK3gjlENOIoULvdCtEQLD-HDMMHAlQjAj7VEdADENg1MYNhQMUwGNxPV43SRdsmg0srygLjSB4qRfH4tCfgfEScPE-CpOIxBVO6HQiLbVUQR8dTYzAmgWOJAB1MAACMDB42BllIHhcwwA4jhOc4OAAd2C0LyUpCKeBvT4a0sjDhKGfxmxDXwMT0KIDF7dpYUono9B7YxbAI4xHGMLymK0hlWMCkKwoyjBN23Xd90PUhjxwM9kp6tLTUijAstQnL+TyhA0X6Z9itK8rKphUwgW-MrfFCXpKJcejgJnPFmO0yCOG61KTXCxRZqM8RNFgAoDjwTMxBwAAKaQAEpxBAy6OsTJc7t6p6eCM+aBNyoSEAqgjFVIz0LE6CxWz0PtOz0Dg9HBMquh8LowTa0H52u1iAAU8BwWAwG8nY9hi-N4oORR6cZ5nKjhiylsRgxwQsJtCOlIIdFHaQWz7AwJ2-FyCMGEMMbOsZGMp8DqeJOmGaZ9r2AGnc9wPI9T33bmDa1ubuVvAXnWFywxax0mpfRWWqpVUWSqUgYw2F5xWvOzXNKpzriQAIVZVABAgMsxE0UhYGi2KCwSoKY7jhOwCT2B+cW50e09RUSshJwQ0nGSdEbKx-1bUI7IsCmw+1iOl2j2P46oRPk+NoazdGi3M67nO84Lvki8CQd+hljsK+bByEDq7oKocbtI3BOurBbuc2-B7IaZ3BgIDAMe+9ZtOOf3Y-UFP8-87t7LJ4fcwyqbbGezq-orFlKqCLIs4XwVFgjSFOr-XePkLS61vvfHuuc+5bhNsNc240b4UBPmfeB48n4LRfstN+hVP7CxlMAv+MIBxyRlAVSck5xSQKuu3bIINW79UvuzQsHBVChz3rbcyhcHx1xKhwVEwwQgV0nFYGSv8EQDCFD4GuehVQ7xDhpXh0ClwsN4f3U2I0xpnm4WonyE97zLSEd0URAxxHOEkX2aQAxFRgLKqqVWDYGFgx0pwLRPkjImRMYJGoQJnBNiFIdCSIJwgySGE2SwZVwgr1DO48OB8vEXVYb46afFqz4MRkE7oVhQlYyBBE7augDC+DkgUiUZgqnlLqkk-eniOCRwEEcCA3iFgADFBACCCiQXi7C4qcKCq0jA7S0m8O6QIXp-T-EIxqNKFs35VQSlVDKQmpg5aohESqAcnQQT1NUbzZJTSWltI6ZUKZMykJIIHno4eozxk8J8lcvplI5mCwWeYRsEkWzNXbJ2YwfY-D42kKieJHY2zNgab5HWHdHkXPYK8-pGSTTIWyaYxGk5IjPmsHXfQeEoT-1UqLfowpKIdlWUBDWRjGEpOaQiiZLyelvNOKipCdp+E5JqNiowzY8U+FskSkiw5TAmGlCEQioR_j6BiFqDAFBT7wFKIixpkEMUBMQAAWnIdqxsIQQiE3BGClx0QjmGzVaxHgahBC3DEBq-ZiBUQyXCE2YWSjJxgOFtC81NsNHZGpNcOkcKEbw0-Y5OuJg1ZDCUSqQFuNgHfmDN2AOYCnBTl9aw_1nAeKBvNH5ZkbIOQOvDQgA1AQxy2BbKdWwuNmwmDqo4cwjRykwuzWxVc650AludDXMBPRmoGAlP8cwTg5aRs6GGGu-g0RgJUTS45lrkzsX0rBQyRbjLTR7VZex-g0QuU6HXIdE5Sm1GDKLHQSsgkShDMLNtBbsiQ2mo9Wa27lrANdWYP2_QPKdikf_ORAQpZKLBUKds96Q2cCfQ9PqRk31Cxlvjaw7YKIQk9iRYB_hKUFJogU4BEGmGcD1jzC1gsw2Ox7EYYWql5aqS6MUuWdgjAhjrpQ7GSiCP0s7tnbByd4M1GDK6hwlEpRbyBcS_0_LURlTqiEMwnGmlHwwXfLBGBe7KufpigTVFGzlKVJ6cMX65YQnkljaVUo_DdgUzdVVZGHaCNHP4Fy2KP32OCDJBx1gzCIkIuiexzdM3qIfak55loN08X44gX-nYAzlOA_oKio4ZKExMFLFUQJ4mnWs6xM5YzbPIspJFhAXR0QBkOkKLGdUOybIA4YAIwDDCehVCCfDgWoHBYZecplXSWUovC1u-2AjlpgiYyIicl6St4SXvI7oX7RzWCDFhbLxJkCsmIEwWAGm8Fab-EdiqtFfT_HxgOd0TsQMdjlVEIAA */
      id: "VerifySafeAddressDeviceAction",
      initial: "InitialState",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: VerifySafeAddressDAStep.OPEN_APP,
          },
          _internalState: {
            error: null,
            contexts: [],
          },
        };
      },
      states: {
        InitialState: {
          always: [
            {
              target: "BuildSafeAddressContexts",
              guard: "skipOpenApp",
            },
            "OpenAppDeviceAction",
          ],
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            input: {
              appName: "Ethereum",
            },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: VerifySafeAddressDAStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<VerifySafeAddressDAInternalState>(
                    {
                      Right: () => _.context._internalState,
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  );
                },
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            {
              target: "BuildSafeAddressContexts",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        BuildSafeAddressContexts: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: VerifySafeAddressDAStep.BUILD_CONTEXTS,
            },
          }),
          invoke: {
            id: "buildSafeAddressContexts",
            src: "buildSafeAddressContexts",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              safeContractAddress: context.input.safeContractAddress,
              options: context.input.options,
              deviceModelId: internalApi.getDeviceModel().id,
            }),
            onDone: {
              target: "ProvideContexts",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    contexts: event.output.clearSignContexts,
                  }),
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideContexts: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: VerifySafeAddressDAStep.VERIFY_SAFE_ADDRESS,
            },
          }),
          invoke: {
            id: "provideContexts",
            src: "provideContexts",
            input: ({ context }) => ({
              contexts: context._internalState
                .contexts as ClearSignContextSuccess[],
            }),
            onDone: {
              target: "ProvideContextsResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (event.output.isLeft()) {
                      return {
                        ...context._internalState,
                        error: event.output.extract(),
                      };
                    }

                    return {
                      ...context._internalState,
                      error: null,
                    };
                  },
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideContextsResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            { target: "Error" },
          ],
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: ({ context }) =>
        context._internalState.error
          ? Left(context._internalState.error)
          : Right(void 0),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const buildSafeAddressContexts = async (arg0: {
      input: BuildSafeAddressContextTaskArgs;
    }) => new BuildSafeAddressContextTask(internalApi, arg0.input).run();

    const provideContexts = async (arg0: {
      input: {
        contexts: ClearSignContextSuccess[];
      };
    }) => {
      for (const context of arg0.input.contexts) {
        const res = await new ProvideContextTask(internalApi, {
          context,
        }).run();

        if (!isSuccessCommandResult(res)) {
          return Left(res.error);
        }
      }
      return Right(void 0);
    };

    return {
      provideContexts,
      buildSafeAddressContexts,
    };
  }
}

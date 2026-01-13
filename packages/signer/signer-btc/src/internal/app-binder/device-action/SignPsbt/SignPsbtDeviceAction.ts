import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignPsbtDAError,
  type SignPsbtDAInput,
  type SignPsbtDAIntermediateValue,
  type SignPsbtDAInternalState,
  type SignPsbtDAOutput,
} from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type Psbt as ApiPsbt } from "@api/model/Psbt";
import { type PsbtSignature } from "@api/model/Signature";
import { type Wallet as ApiWallet } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import {
  BuildPsbtTask,
  type BuildPsbtTaskResult,
} from "@internal/app-binder/task/BuildPsbtTask";
import { PrepareWalletPolicyTask } from "@internal/app-binder/task/PrepareWalletPolicyTask";
import { SignPsbtTask } from "@internal/app-binder/task/SignPsbtTask";
import type { DataStoreService } from "@internal/data-store/service/DataStoreService";
import type { PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import type { ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type MachineDependencies = {
  readonly prepareWalletPolicy: (arg0: {
    input: {
      wallet: ApiWallet;
      walletBuilder: WalletBuilder;
    };
  }) => Promise<CommandResult<InternalWallet, BtcErrorCodes>>;
  readonly buildPsbt: (arg0: {
    input: {
      psbt: ApiPsbt;
      wallet: InternalWallet;
      dataStoreService: DataStoreService;
      psbtMapper: PsbtMapper;
    };
  }) => Promise<CommandResult<BuildPsbtTaskResult, BtcErrorCodes>>;
  readonly signPsbt: (arg0: {
    input: {
      wallet: InternalWallet;
      buildPsbtResult: BuildPsbtTaskResult;
      walletSerializer: WalletSerializer;
      valueParser: ValueParser;
    };
  }) => Promise<CommandResult<PsbtSignature[], BtcErrorCodes>>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class SignPsbtDeviceAction extends XStateDeviceAction<
  SignPsbtDAOutput,
  SignPsbtDAInput,
  SignPsbtDAError,
  SignPsbtDAIntermediateValue,
  SignPsbtDAInternalState
> {
  constructor(args: {
    input: SignPsbtDAInput;
    inspect?: boolean;
    loggerFactory?: (tag: string) => LoggerPublisherService;
  }) {
    super({
      input: args.input,
      inspect: args.inspect,
      logger: args.loggerFactory?.("SignPsbtDeviceAction"),
    });
  }

  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignPsbtDAOutput,
    SignPsbtDAInput,
    SignPsbtDAError,
    SignPsbtDAIntermediateValue,
    SignPsbtDAInternalState
  > {
    type types = StateMachineTypes<
      SignPsbtDAOutput,
      SignPsbtDAInput,
      SignPsbtDAError,
      SignPsbtDAIntermediateValue,
      SignPsbtDAInternalState
    >;

    const { signPsbt, prepareWalletPolicy, buildPsbt } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "Bitcoin" },
        }).makeStateMachine(internalApi),
        prepareWalletPolicy: fromPromise(prepareWalletPolicy),
        buildPsbt: fromPromise(buildPsbt),
        signPsbt: fromPromise(signPsbt),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AFMAnWA9hgIYA2AsnLMTACJgBuqAxmAILMAuqRAdAPIAHMBjaDB9Jqw7ciAYghEwvVBgYEA1soLDR45J2Kcw5YswAWqsAG0ADAF1EoQQVipZGJyAAeiACwAzADsvACcABwAjKGRtuG2AGyRSX4ANCAAnoiRAEwArLy2uX6RQUGRpeHhfgC+NelomDj4RGSUsNR0jCzsXDwYvADC5mDMGkIiYhLd0n1EAEpwAK6knHJ2jkggLm4eXr4IoRG8eTlFOaWhQX45QaHpWQiRN4UBfu8JeaE3obY5OXUGuhsHhCCQKFQaGBJD0ZP0hiMxhM9NMpL0PItYCs1tZIptnK53P19ogjuETmdcpdrrd7pl-M8wnkgvkgvFbH48n4EkFASBGiCWuD2p1oTN0fCBc0wW1ITAFEoVGpNMo3E1Qa0IR0oRsvDsiUQSU88tVeOEktEEuE8m8cjcHqScicgokTXk8rZygFQgD6vzgdLNSKoTDZh5eFKNcK5WA5HhcARcLxBKQjAAzRMAW14asFMq1ot1W31ey2B0iJr8ZotoStNpu9vpCDtoTNHr8PoizyKvL9kaFsu1XTRcL4-fzwZgmOxw1GGnWDj1hNLoAOFwCBWC5u5RySEQdT1sra+OSt1wCAQuzICfPHQZjoYlY4DUcHounq1nY3WeKXu2JZaIOum5sgkO61tE4QHhWBS2HkCT-G8R5wc8N58hgBAQHAXh3tGQ5iiOcyeMWy4AauiAALQJAeVGFLY9EMYxDG9kC6oDgWIbiqOAzIlMj7cX+BrEeRCCNo8sS2CcRz-B6zIsnBaGsXm974fxREInOvHiGpGLLKsgkrj4iBnrwFwVgkCHfEeCQBNB3K8IEpxBO6ySep8in+mxE4Plx6m4W+UIGWRRlPJEVRmncOTmhyLI2QeUS8GFQRvPBXZRLWt4vuxk4EbCflZd5+EfpwX4aEFhqAU84RRYUpyXmBATJBeQTQZEARhKEG5Ne69GUplXkqaKOmSkszCsB05XCSFOSXgUyVshUdoJLYF7QYkvAXkUER3H45q1qE-XKXhQ2+eGACiuAJrgk1GjN+S8PNUTFMtq1Nrckl-O6wTct6KF5HUdRAA */
      id: "SignPsbtDeviceAction",
      initial: "InitialState",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            wallet: null,
            buildPsbtResult: null,
            signatures: null,
            signedPsbt: null,
          },
        };
      },
      states: {
        InitialState: {
          always: [
            {
              target: "PrepareWalletPolicy",
              guard: "skipOpenApp",
            },
            "OpenAppDeviceAction",
          ],
        },
        OpenAppDeviceAction: {
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "openAppStateMachine",
            input: { appName: "Bitcoin" },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<SignPsbtDAInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            {
              target: "PrepareWalletPolicy",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        PrepareWalletPolicy: {
          invoke: {
            id: "prepareWalletPolicy",
            src: "prepareWalletPolicy",
            input: ({ context }) => ({
              wallet: context.input.wallet,
              walletBuilder: context.input.walletBuilder,
            }),
            onDone: {
              target: "PrepareWalletPolicyResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      wallet: event.output.data,
                    };
                  }
                  return {
                    ...context._internalState,
                    error: event.output.error,
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        PrepareWalletPolicyResultCheck: {
          always: [
            { guard: "noInternalError", target: "BuildPsbt" },
            { target: "Error" },
          ],
        },
        BuildPsbt: {
          invoke: {
            id: "buildPsbt",
            src: "buildPsbt",
            input: ({ context }) => ({
              psbt: context.input.psbt,
              wallet: context._internalState.wallet!,
              dataStoreService: context.input.dataStoreService,
              psbtMapper: context.input.psbtMapper,
            }),
            onDone: {
              target: "BuildPsbtResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      buildPsbtResult: event.output.data,
                    };
                  }
                  return {
                    ...context._internalState,
                    error: event.output.error,
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        BuildPsbtResultCheck: {
          always: [
            { guard: "noInternalError", target: "SignPsbt" },
            { target: "Error" },
          ],
        },
        SignPsbt: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signPsbt",
            src: "signPsbt",
            input: ({ context }) => ({
              walletSerializer: context.input.walletSerializer,
              valueParser: context.input.valueParser,
              buildPsbtResult: context._internalState.buildPsbtResult!,
              wallet: context._internalState.wallet!,
            }),
            onDone: {
              target: "SignPsbtResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      signatures: event.output.data,
                    };
                  }
                  return {
                    ...context._internalState,
                    error: event.output.error,
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignPsbtResultCheck: {
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
      output: ({
        context: {
          _internalState: { signatures, error },
        },
      }) =>
        signatures
          ? Right(signatures)
          : Left(error || new UnknownDAError("No error in final state")),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const prepareWalletPolicy = async (arg0: {
      input: { wallet: ApiWallet; walletBuilder: WalletBuilder };
    }): Promise<CommandResult<InternalWallet, BtcErrorCodes>> => {
      const {
        input: { walletBuilder, wallet },
      } = arg0;
      return await new PrepareWalletPolicyTask(
        internalApi,
        { wallet },
        walletBuilder,
      ).run();
    };
    const buildPsbt = async (arg0: {
      input: {
        psbt: ApiPsbt;
        wallet: InternalWallet;
        dataStoreService: DataStoreService;
        psbtMapper: PsbtMapper;
      };
    }): Promise<CommandResult<BuildPsbtTaskResult, BtcErrorCodes>> => {
      const {
        input: { psbt, wallet, dataStoreService, psbtMapper },
      } = arg0;
      return new BuildPsbtTask(
        { psbt, wallet },
        dataStoreService,
        psbtMapper,
      ).run();
    };
    const signPsbt = async (arg0: {
      input: {
        wallet: InternalWallet;
        buildPsbtResult: BuildPsbtTaskResult;
        walletSerializer: WalletSerializer;
        valueParser: ValueParser;
      };
    }): Promise<CommandResult<PsbtSignature[], BtcErrorCodes>> => {
      const {
        input: { wallet, buildPsbtResult, walletSerializer, valueParser },
      } = arg0;
      return await new SignPsbtTask(
        internalApi,
        { wallet, ...buildPsbtResult },
        walletSerializer,
        valueParser,
      ).run();
    };

    return {
      prepareWalletPolicy,
      buildPsbt,
      signPsbt,
    };
  }
}

import {
  type CommandResult,
  type DeviceActionStateMachine,
  type HexaString,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Psbt as ApiPsbt } from "@api/model/Psbt";
import { type PsbtSignature } from "@api/model/Signature";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { SignPsbtDeviceAction } from "@internal/app-binder/device-action/SignPsbt/SignPsbtDeviceAction";
import { NullLoggerPublisherService } from "@internal/app-binder/services/utils/NullLoggerPublisherService";
import { ExtractTransactionTask } from "@internal/app-binder/task/ExtractTransactionTask";
import { UpdatePsbtTask } from "@internal/app-binder/task/UpdatePsbtTask";
import { type Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import type { ValueParser } from "@internal/psbt/service/value/ValueParser";

export type MachineDependencies = {
  readonly updatePsbt: (arg0: {
    input: {
      psbt: ApiPsbt;
      signatures: PsbtSignature[];
      psbtMapper: PsbtMapper;
      valueParser: ValueParser;
    };
  }) => Promise<CommandResult<InternalPsbt, BtcErrorCodes>>;
  readonly extractTransaction: (arg0: {
    input: { psbt: InternalPsbt; valueParser: ValueParser };
  }) => Promise<CommandResult<HexaString, BtcErrorCodes>>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class SignTransactionDeviceAction extends XStateDeviceAction<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  SignTransactionDAInternalState
> {
  private readonly _loggerFactory: (tag: string) => LoggerPublisherService;

  constructor(args: {
    input: SignTransactionDAInput;
    inspect?: boolean;
    loggerFactory?: (tag: string) => LoggerPublisherService;
  }) {
    super({
      input: args.input,
      inspect: args.inspect,
      logger: args.loggerFactory?.("SignTransactionDeviceAction"),
    });
    this._loggerFactory = args.loggerFactory ?? NullLoggerPublisherService;
  }

  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTransactionDAOutput,
    SignTransactionDAInput,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue,
    SignTransactionDAInternalState
  > {
    type types = StateMachineTypes<
      SignTransactionDAOutput,
      SignTransactionDAInput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue,
      SignTransactionDAInternalState
    >;

    const { updatePsbt, extractTransaction } = this.extractDependencies();

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },

      actors: {
        signPsbtStateMachine: new SignPsbtDeviceAction({
          input: this.input,
          loggerFactory: this._loggerFactory,
        }).makeStateMachine(internalApi),
        updatePsbt: fromPromise(updatePsbt),
        extractTransaction: fromPromise(extractTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
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
      initial: "SignPsbtDeviceAction",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            signatures: null,
            signedPsbt: null,
            transaction: null,
          },
        };
      },
      states: {
        SignPsbtDeviceAction: {
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signPsbtStateMachine",
            src: "signPsbtStateMachine",
            input: ({ context }) => context.input,
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "SignPsbtResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  return event.output.caseOf<SignTransactionDAInternalState>({
                    Right: (data) => ({
                      ...context._internalState,
                      signatures: data,
                    }),
                    Left: (error) => ({
                      ...context._internalState,
                      error,
                    }),
                  });
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
            { guard: "noInternalError", target: "UpdatePsbt" },
            { target: "Error" },
          ],
        },
        UpdatePsbt: {
          invoke: {
            id: "updatePsbt",
            src: "updatePsbt",
            input: ({ context }) => ({
              psbt: context.input.psbt,
              valueParser: context.input.valueParser,
              psbtMapper: context.input.psbtMapper,
              signatures: context._internalState.signatures!,
            }),
            onDone: {
              target: "UpdatePsbtResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      signedPsbt: event.output.data,
                    };
                  } else {
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };
                  }
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        UpdatePsbtResultCheck: {
          always: [
            { guard: "noInternalError", target: "ExtractTransaction" },
            { target: "Error" },
          ],
        },
        ExtractTransaction: {
          invoke: {
            id: "extractTransaction",
            src: "extractTransaction",
            input: ({ context }) => ({
              valueParser: context.input.valueParser,
              psbt: context._internalState.signedPsbt!,
            }),
            onDone: {
              target: "ExtractTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      transaction: event.output.data,
                    };
                  } else {
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };
                  }
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ExtractTransactionResultCheck: {
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
        context._internalState.transaction
          ? Right(context._internalState.transaction)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(): MachineDependencies {
    const updatePsbt = async (arg0: {
      input: {
        psbt: ApiPsbt;
        signatures: PsbtSignature[];
        psbtMapper: PsbtMapper;
        valueParser: ValueParser;
      };
    }): Promise<CommandResult<InternalPsbt, BtcErrorCodes>> => {
      const {
        input: { psbt, signatures, valueParser, psbtMapper },
      } = arg0;
      return await new UpdatePsbtTask(
        { psbt, signatures },
        valueParser,
        psbtMapper,
      ).run();
    };

    const extractTransaction = async (arg0: {
      input: { psbt: InternalPsbt; valueParser: ValueParser };
    }): Promise<CommandResult<HexaString, BtcErrorCodes>> => {
      const {
        input: { psbt, valueParser },
      } = arg0;
      return new ExtractTransactionTask({ psbt }, valueParser).run();
    };

    return {
      updatePsbt,
      extractTransaction,
    };
  }
}

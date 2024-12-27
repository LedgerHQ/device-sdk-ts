import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignMessageDAError,
  type SignMessageDAInput,
  type SignMessageDAIntermediateValue,
  type SignMessageDAInternalState,
  type SignMessageDAOutput,
} from "@api/app-binder/SignMessageDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import {
  SendSignMessageTask,
  type SendSignMessageTaskArgs,
} from "@internal/app-binder/task/SignMessageTask";

export type MachineDependencies = {
  readonly signMessage: (arg0: {
    input: SendSignMessageTaskArgs;
  }) => Promise<CommandResult<Signature, BtcErrorCodes>>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class SignMessageDeviceAction extends XStateDeviceAction<
  SignMessageDAOutput,
  SignMessageDAInput,
  SignMessageDAError,
  SignMessageDAIntermediateValue,
  SignMessageDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignMessageDAOutput,
    SignMessageDAInput,
    SignMessageDAError,
    SignMessageDAIntermediateValue,
    SignMessageDAInternalState
  > {
    type types = StateMachineTypes<
      SignMessageDAOutput,
      SignMessageDAInput,
      SignMessageDAError,
      SignMessageDAIntermediateValue,
      SignMessageDAInternalState
    >;

    const { signMessage } = this.extractDependencies(internalApi);

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
        signMessage: fromPromise(signMessage),
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
      id: "SignMessageDeviceAction",
      initial: "OpenAppDeviceAction",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            signature: null,
          },
        };
      },
      states: {
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
                  return _.event.output.caseOf<SignMessageDAInternalState>({
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
              target: "SignMessage",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        SignMessage: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction:
                UserInteractionRequired.SignPersonalMessage,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signMessage",
            src: "signMessage",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              message: context.input.message,
            }),
            onDone: {
              target: "SignMessageResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        signature: event.output.data,
                      };
                    }
                    return {
                      ...context._internalState,
                      error: event.output.error,
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
        SignMessageResultCheck: {
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
        context._internalState.signature
          ? Right(context._internalState.signature)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const signMessage = async (arg0: {
      input: {
        derivationPath: string;
        message: string;
      };
    }) => new SendSignMessageTask(internalApi, arg0.input).run();

    return {
      signMessage,
    };
  }
}

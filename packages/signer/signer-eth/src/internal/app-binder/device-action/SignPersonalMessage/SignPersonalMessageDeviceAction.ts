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
  type SignPersonalMessageDAError,
  type SignPersonalMessageDAInput,
  type SignPersonalMessageDAIntermediateValue,
  type SignPersonalMessageDAInternalState,
  type SignPersonalMessageDAOutput,
} from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { SendSignPersonalMessageTask } from "@internal/app-binder/task/SendSignPersonalMessageTask";

export type MachineDependencies = {
  readonly signPersonalMessage: (arg0: {
    input: {
      derivationPath: string;
      message: string | Uint8Array;
    };
  }) => Promise<CommandResult<Signature, EthErrorCodes>>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class SignPersonalMessageDeviceAction extends XStateDeviceAction<
  SignPersonalMessageDAOutput,
  SignPersonalMessageDAInput,
  SignPersonalMessageDAError,
  SignPersonalMessageDAIntermediateValue,
  SignPersonalMessageDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignPersonalMessageDAOutput,
    SignPersonalMessageDAInput,
    SignPersonalMessageDAError,
    SignPersonalMessageDAIntermediateValue,
    SignPersonalMessageDAInternalState
  > {
    type types = StateMachineTypes<
      SignPersonalMessageDAOutput,
      SignPersonalMessageDAInput,
      SignPersonalMessageDAError,
      SignPersonalMessageDAIntermediateValue,
      SignPersonalMessageDAInternalState
    >;

    const { signPersonalMessage } = this.extractDependencies(internalApi);

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
        signPersonalMessage: fromPromise(signPersonalMessage),
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
      id: "SignPersonalMessageDeviceAction",
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
            input: { appName: "Ethereum" },
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
                  return _.event.output.caseOf<SignPersonalMessageDAInternalState>(
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
              target: "SignPersonalMessage",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        SignPersonalMessage: {
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
            id: "signPersonalMessage",
            src: "signPersonalMessage",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              message: context.input.message,
            }),
            onDone: {
              target: "SignPersonalMessageResultCheck",
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
        SignPersonalMessageResultCheck: {
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
    const signPersonalMessage = async (arg0: {
      input: {
        derivationPath: string;
        message: string | Uint8Array;
      };
    }) => new SendSignPersonalMessageTask(internalApi, arg0.input).run();

    return {
      signPersonalMessage,
    };
  }
}

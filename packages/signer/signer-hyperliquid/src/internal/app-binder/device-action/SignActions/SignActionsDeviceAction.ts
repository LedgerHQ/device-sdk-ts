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
  type SignActionsDAError,
  type SignActionsDAInput,
  type SignActionsDAIntermediateValue,
  type SignActionsDAInternalState,
  type SignActionsDAOutput,
  signActionsDAStateSteps,
} from "@api/app-binder/SignActionsDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { SendCertificateCommand } from "@internal/app-binder/command/SendCertificateCommand";
import { SendMetadataCommand } from "@internal/app-binder/command/SendMetadataCommand";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";
import { SendActionsTask } from "@internal/app-binder/task/SendActionsTask";
import { SignActionsTask } from "@internal/app-binder/task/SignActionsTask";
import type { HyperliquidAction } from "@internal/app-binder/utils/actionTlvSerializer";

const APP_NAME = "HyperLiquid";

export type SignActionsMachineDependencies = {
  readonly setCertificate: (
    certificate: Uint8Array,
  ) => Promise<CommandResult<void, HyperliquidErrorCodes>>;
  readonly sendMetadata: (
    signedMetadata: Uint8Array,
  ) => Promise<CommandResult<void, HyperliquidErrorCodes>>;
  readonly sendActions: (
    actions: HyperliquidAction[],
  ) => Promise<CommandResult<void, HyperliquidErrorCodes>>;
  readonly signActions: () => Promise<
    CommandResult<Signature[], HyperliquidErrorCodes>
  >;
};

export class SignActionsDeviceAction extends XStateDeviceAction<
  SignActionsDAOutput,
  SignActionsDAInput,
  SignActionsDAError,
  SignActionsDAIntermediateValue,
  SignActionsDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignActionsDAOutput,
    SignActionsDAInput,
    SignActionsDAError,
    SignActionsDAIntermediateValue,
    SignActionsDAInternalState
  > {
    type types = StateMachineTypes<
      SignActionsDAOutput,
      SignActionsDAInput,
      SignActionsDAError,
      SignActionsDAIntermediateValue,
      SignActionsDAInternalState
    >;

    const { setCertificate, sendMetadata, sendActions, signActions } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
        setCertificate: fromPromise(({ input }: { input: Uint8Array }) =>
          setCertificate(input),
        ),
        sendMetadata: fromPromise(({ input }: { input: Uint8Array }) =>
          sendMetadata(input),
        ),
        sendActions: fromPromise(({ input }: { input: HyperliquidAction[] }) =>
          sendActions(input),
        ),
        signActions: fromPromise(() => signActions()),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => context.input.skipOpenApp === true,
        hasMoreActions: ({ context }) =>
          context._internalState.actionIndex < context.input.actions.length,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: ({ event }) => ({
            error: new UnknownDAError(
              event["error"] instanceof Error
                ? event["error"].message
                : String(event["error"]),
            ) as SignActionsDAError,
            signature: null,
            actionIndex: 0,
          }),
        }),
      },
    }).createMachine({
      id: "SignActionsDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signActionsDAStateSteps.OPEN_APP,
        },
        _internalState: {
          error: null,
          signature: null,
          actionIndex: 0,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "SetCertificate", guard: "skipOpenApp" },
            { target: "OpenAppDeviceAction" },
          ],
        },
        OpenAppDeviceAction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signActionsDAStateSteps.OPEN_APP,
            }),
          }),
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: () => ({ appName: APP_NAME }),
            onSnapshot: {
              actions: assign({
                intermediateValue: () => ({
                  requiredUserInteraction: UserInteractionRequired.None,
                  step: signActionsDAStateSteps.OPEN_APP,
                }),
              }),
            },
            onDone: {
              target: "CheckOpenAppResult",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf({
                    Right: () => context._internalState,
                    Left: (error) => ({
                      ...context._internalState,
                      error: error as SignActionsDAError,
                    }),
                  }),
              }),
            },
          },
        },
        CheckOpenAppResult: {
          always: [
            { target: "SetCertificate", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        SetCertificate: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signActionsDAStateSteps.SET_CERTIFICATE,
            }),
          }),
          invoke: {
            id: "setCertificate",
            src: "setCertificate",
            input: ({ context }) => context.input.certificate,
            onDone: {
              target: "SetCertificateResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? context._internalState
                    : {
                        ...context._internalState,
                        error: event.output.error as SignActionsDAError,
                      },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SetCertificateResultCheck: {
          always: [
            { target: "SendMetadata", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        SendMetadata: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signActionsDAStateSteps.SEND_METADATA,
            }),
          }),
          invoke: {
            id: "sendMetadata",
            src: "sendMetadata",
            input: ({ context }) => context.input.signedMetadata,
            onDone: {
              target: "SendMetadataResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? context._internalState
                    : {
                        ...context._internalState,
                        error: event.output.error as SignActionsDAError,
                      },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SendMetadataResultCheck: {
          always: [
            { target: "SendActionsLoop", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        SendActionsLoop: {
          always: [
            {
              target: "SendActions",
              guard: "hasMoreActions",
            },
            { target: "SignActions" },
          ],
        },
        SendActions: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signActionsDAStateSteps.SEND_ACTION,
            }),
          }),
          invoke: {
            id: "sendActions",
            src: "sendActions",
            input: ({ context }) => context.input.actions,
            onDone: {
              target: "SendActionsResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? context._internalState
                    : {
                        ...context._internalState,
                        error: event.output.error as SignActionsDAError,
                      },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SendActionsResultCheck: {
          always: [
            { target: "SendActionsLoop", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        SignActions: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signActionsDAStateSteps.SIGN_ACTIONS,
            }),
          }),
          invoke: {
            id: "signActions",
            src: "signActions",
            onDone: {
              target: "SignActionsResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        signature: event.output.data,
                      }
                    : {
                        ...context._internalState,
                        error: event.output.error as SignActionsDAError,
                      },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignActionsResultCheck: {
          always: [
            { target: "Success", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) =>
        context._internalState.signature
          ? Right(context._internalState.signature)
          : Left(
              context._internalState.error ??
                new UnknownDAError("No error or signature available"),
            ),
    });
  }

  extractDependencies(
    internalApi: InternalApi,
  ): SignActionsMachineDependencies {
    const setCertificate = (certificate: Uint8Array) =>
      internalApi.sendCommand(new SendCertificateCommand({ certificate }));

    const sendMetadata = (signedMetadata: Uint8Array) =>
      internalApi.sendCommand(new SendMetadataCommand({ signedMetadata }));

    const sendActions = (actions: HyperliquidAction[]) =>
      new SendActionsTask(internalApi, { actions }).run();

    const signActions = () => new SignActionsTask(internalApi).run();

    return {
      setCertificate,
      sendMetadata,
      sendActions,
      signActions,
    };
  }
}

// XState device action for M6 — Register a signer-controlled Ledger
// account. Orchestrates two APDUs:
//   1. RegisterLedgerAccountCommand — requires on-device approval, returns
//      a 32-byte HMAC proof.
//   2. GetAddressCommand (checkOnDevice=false, chainId framed) — silent;
//      returns the derived ETH address so the wallet can cache it.
//
// Mirrors the playground orchestration at
// ~/dev/ledger-contacts-playground/src/ledger_contacts/service.py:342-425
// (add_account). Pattern follows VerifySafeAddressDeviceAction.
import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";
import {
  type RegisterLedgerAccountDAError,
  type RegisterLedgerAccountDAInput,
  type RegisterLedgerAccountDAIntermediateValue,
  type RegisterLedgerAccountDAInternalState,
  type RegisterLedgerAccountDAOutput,
  RegisterLedgerAccountDAStep,
} from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import {
  RegisterLedgerAccountCommand,
  type RegisterLedgerAccountCommandArgs,
  type RegisterLedgerAccountCommandResponse,
} from "@internal/app-binder/command/RegisterLedgerAccountCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { APP_NAME } from "@internal/app-binder/constants";

export type MachineDependencies = {
  readonly registerLedgerAccount: (arg0: {
    input: RegisterLedgerAccountCommandArgs;
  }) => Promise<
    CommandResult<RegisterLedgerAccountCommandResponse, EthErrorCodes>
  >;
  readonly getAddress: (arg0: {
    input: GetAddressCommandArgs;
  }) => Promise<CommandResult<GetAddressCommandResponse, EthErrorCodes>>;
};

function stripHexPrefix(hex: string): string {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

export class RegisterLedgerAccountDeviceAction extends XStateDeviceAction<
  RegisterLedgerAccountDAOutput,
  RegisterLedgerAccountDAInput,
  RegisterLedgerAccountDAError,
  RegisterLedgerAccountDAIntermediateValue,
  RegisterLedgerAccountDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    RegisterLedgerAccountDAOutput,
    RegisterLedgerAccountDAInput,
    RegisterLedgerAccountDAError,
    RegisterLedgerAccountDAIntermediateValue,
    RegisterLedgerAccountDAInternalState
  > {
    type types = StateMachineTypes<
      RegisterLedgerAccountDAOutput,
      RegisterLedgerAccountDAInput,
      RegisterLedgerAccountDAError,
      RegisterLedgerAccountDAIntermediateValue,
      RegisterLedgerAccountDAInternalState
    >;

    const { registerLedgerAccount, getAddress } =
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
        registerLedgerAccount: fromPromise(registerLedgerAccount),
        getAddress: fromPromise(getAddress),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            // XState onError events carry the error in `event.error` but lose
            // our typed error union here; treat as any (consistent with
            // SignTransactionDeviceAction / VerifySafeAddressDeviceAction).
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            error: _.event["error"],
          }),
        }),
      },
    }).createMachine({
      id: "RegisterLedgerAccountDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: RegisterLedgerAccountDAStep.OPEN_APP,
        },
        _internalState: {
          error: null,
          hmacProofHex: null,
          addressHex: null,
        },
      }),
      states: {
        InitialState: {
          always: "OpenAppDeviceAction",
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            input: { appName: APP_NAME },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: RegisterLedgerAccountDAStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<RegisterLedgerAccountDAInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            { target: "RegisterLedgerAccount", guard: "noInternalError" },
            "Error",
          ],
        },
        RegisterLedgerAccount: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.RegisterWallet,
              step: RegisterLedgerAccountDAStep.REGISTER_LEDGER_ACCOUNT,
            },
          }),
          invoke: {
            id: "registerLedgerAccount",
            src: "registerLedgerAccount",
            input: ({ context }) => ({
              name: context.input.name,
              derivationPath: context.input.derivationPath,
              chainId: context.input.chainId,
            }),
            onDone: {
              target: "CheckRegisterLedgerAccountResult",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      hmacProofHex: event.output.data.hmacProofHex,
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
        CheckRegisterLedgerAccountResult: {
          always: [{ target: "GetAddress", guard: "noInternalError" }, "Error"],
        },
        GetAddress: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: RegisterLedgerAccountDAStep.GET_ADDRESS,
            },
          }),
          invoke: {
            id: "getAddress",
            src: "getAddress",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              checkOnDevice: false,
              returnChainCode: false,
              chainId: context.input.chainId,
            }),
            onDone: {
              target: "CheckGetAddressResult",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      addressHex: stripHexPrefix(
                        event.output.data.address,
                      ).toLowerCase(),
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
        CheckGetAddressResult: {
          always: [{ target: "Success", guard: "noInternalError" }, "Error"],
        },
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) =>
        context._internalState.error
          ? Left(context._internalState.error)
          : Right({
              hmacProofHex: context._internalState.hmacProofHex!,
              addressHex: context._internalState.addressHex!,
            }),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const registerLedgerAccount = async (arg0: {
      input: RegisterLedgerAccountCommandArgs;
    }) => internalApi.sendCommand(new RegisterLedgerAccountCommand(arg0.input));

    const getAddress = async (arg0: { input: GetAddressCommandArgs }) =>
      internalApi.sendCommand(new GetAddressCommand(arg0.input));

    return { registerLedgerAccount, getAddress };
  }
}

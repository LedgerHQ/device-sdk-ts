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
  type RegisterWalletPolicyDAError,
  type RegisterWalletPolicyDAInput,
  type RegisterWalletPolicyDAIntermediateValue,
  type RegisterWalletPolicyDAInternalState,
  type RegisterWalletPolicyDAOutput,
} from "@api/app-binder/RegisterWalletPolicyTypes";
import { type WalletIdentity, type WalletPolicy } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { RegisterWalletPolicyTask } from "@internal/app-binder/task/RegisterWalletPolicyTask";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type MachineDependencies = {
  readonly registerWalletPolicy: (arg0: {
    input: {
      walletPolicy: WalletPolicy;
      dataStoreService: DataStoreService;
      walletSerializer: WalletSerializer;
      walletBuilder: WalletBuilder;
    };
  }) => Promise<CommandResult<WalletIdentity, BtcErrorCodes>>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class RegisterWalletPolicyAction extends XStateDeviceAction<
  RegisterWalletPolicyDAOutput,
  RegisterWalletPolicyDAInput,
  RegisterWalletPolicyDAError,
  RegisterWalletPolicyDAIntermediateValue,
  RegisterWalletPolicyDAInternalState
> {
  constructor(args: { input: RegisterWalletPolicyDAInput; inspect?: boolean }) {
    super(args);
  }
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    RegisterWalletPolicyDAOutput,
    RegisterWalletPolicyDAInput,
    RegisterWalletPolicyDAError,
    RegisterWalletPolicyDAIntermediateValue,
    RegisterWalletPolicyDAInternalState
  > {
    type types = StateMachineTypes<
      RegisterWalletPolicyDAOutput,
      RegisterWalletPolicyDAInput,
      RegisterWalletPolicyDAError,
      RegisterWalletPolicyDAIntermediateValue,
      RegisterWalletPolicyDAInternalState
    >;

    const { registerWalletPolicy } = this.extractDependencies(internalApi);

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
        registerWalletPolicy: fromPromise(registerWalletPolicy),
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
      id: "RegisterWalletPolicyAction",
      initial: "InitialState",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            walletIdentity: null,
          },
        };
      },
      states: {
        InitialState: {
          always: [
            {
              target: "RegisterWalletPolicy",
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
                  return _.event.output.caseOf<RegisterWalletPolicyDAInternalState>(
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
              target: "RegisterWalletPolicy",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        RegisterWalletPolicy: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction:
                UserInteractionRequired.RegisterWalletPolicy,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "registerWalletPolicy",
            src: "registerWalletPolicy",
            input: ({ context }) => ({
              walletPolicy: context.input.walletPolicy,
              dataStoreService: context.input.dataStoreService,
              walletBuilder: context.input.walletBuilder,
              walletSerializer: context.input.walletSerializer,
            }),
            onDone: {
              target: "RegisterWalletPolicyResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        walletIdentity: event.output.data,
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
        RegisterWalletPolicyResultCheck: {
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
        context._internalState.walletIdentity
          ? Right(context._internalState.walletIdentity)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const registerWalletPolicy = async (arg0: {
      input: {
        walletPolicy: WalletPolicy;
        dataStoreService: DataStoreService;
        walletSerializer: WalletSerializer;
        walletBuilder: WalletBuilder;
      };
    }): Promise<CommandResult<WalletIdentity, BtcErrorCodes>> => {
      const {
        input: {
          walletPolicy,
          dataStoreService,
          walletBuilder,
          walletSerializer,
        },
      } = arg0;
      return await new RegisterWalletPolicyTask(
        { walletPolicy },
        dataStoreService,
        walletBuilder,
        internalApi,
        walletSerializer,
      ).run();
    };

    return {
      registerWalletPolicy,
    };
  }
}

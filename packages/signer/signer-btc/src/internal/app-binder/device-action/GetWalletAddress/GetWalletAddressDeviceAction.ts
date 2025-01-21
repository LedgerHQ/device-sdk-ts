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
  type GetWalletAddressDAError,
  type GetWalletAddressDAInput,
  type GetWalletAddressDAIntermediateValue,
  type GetWalletAddressDAInternalState,
  type GetWalletAddressDAOutput,
} from "@api/app-binder/GetWalletAddressDeviceActionTypes";
import { type WalletAddress } from "@api/model/Wallet";
import { type Wallet as ApiWallet } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { GetWalletAddressTask } from "@internal/app-binder/task/GetWalletAddressTask";
import { PrepareWalletPolicyTask } from "@internal/app-binder/task/PrepareWalletPolicyTask";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type GetWalletAddressMachineDependencies = {
  readonly prepareWalletPolicy: (arg0: {
    input: {
      wallet: ApiWallet;
      walletBuilder: WalletBuilder;
    };
  }) => Promise<CommandResult<InternalWallet, BtcErrorCodes>>;
  readonly getWalletAddress: (arg0: {
    input: {
      checkOnDevice: boolean;
      change: boolean;
      addressIndex: number;
      wallet: InternalWallet;
      walletBuilder: WalletBuilder;
      walletSerializer: WalletSerializer;
      dataStoreService: DataStoreService;
    };
  }) => Promise<CommandResult<WalletAddress, BtcErrorCodes>>;
};

export type ExtractGetWalletAddressMachineDependencies = (
  internalApi: InternalApi,
) => GetWalletAddressMachineDependencies;

export class GetWalletAddressDeviceAction extends XStateDeviceAction<
  GetWalletAddressDAOutput,
  GetWalletAddressDAInput,
  GetWalletAddressDAError,
  GetWalletAddressDAIntermediateValue,
  GetWalletAddressDAInternalState
> {
  constructor(args: { input: GetWalletAddressDAInput; inspect?: boolean }) {
    super(args);
  }

  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GetWalletAddressDAOutput,
    GetWalletAddressDAInput,
    GetWalletAddressDAError,
    GetWalletAddressDAIntermediateValue,
    GetWalletAddressDAInternalState
  > {
    type types = StateMachineTypes<
      GetWalletAddressDAOutput,
      GetWalletAddressDAInput,
      GetWalletAddressDAError,
      GetWalletAddressDAIntermediateValue,
      GetWalletAddressDAInternalState
    >;

    const { getWalletAddress, prepareWalletPolicy } =
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
        getWalletAddress: fromPromise(getWalletAddress),
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
      id: "GetWalletAddressDeviceAction",
      initial: "OpenAppDeviceAction",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            wallet: null,
            walletAddress: null,
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
                  return _.event.output.caseOf<GetWalletAddressDAInternalState>(
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
              actions: [
                assign({
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
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        PrepareWalletPolicyResultCheck: {
          always: [
            { guard: "noInternalError", target: "GetWalletAddress" },
            { target: "Error" },
          ],
        },
        GetWalletAddress: {
          entry: assign(({ context }) => ({
            intermediateValue: {
              requiredUserInteraction: context.input.checkOnDevice
                ? UserInteractionRequired.VerifyAddress
                : UserInteractionRequired.None,
            },
          })),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "getWalletAddress",
            src: "getWalletAddress",
            input: ({ context }) => ({
              checkOnDevice: context.input.checkOnDevice,
              wallet: context._internalState.wallet!,
              change: context.input.change,
              addressIndex: context.input.addressIndex,
              dataStoreService: context.input.dataStoreService,
              walletSerializer: context.input.walletSerializer,
              walletBuilder: context.input.walletBuilder,
            }),
            onDone: {
              target: "GetWalletAddressResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        walletAddress: event.output.data,
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
        GetWalletAddressResultCheck: {
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
        context._internalState.walletAddress
          ? Right(context._internalState.walletAddress)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(
    internalApi: InternalApi,
  ): GetWalletAddressMachineDependencies {
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
    const getWalletAddress = async (arg0: {
      input: {
        checkOnDevice: boolean;
        change: boolean;
        addressIndex: number;
        wallet: InternalWallet;
        walletBuilder: WalletBuilder;
        walletSerializer: WalletSerializer;
        dataStoreService: DataStoreService;
      };
    }): Promise<CommandResult<WalletAddress, BtcErrorCodes>> => {
      const {
        checkOnDevice,
        wallet,
        change,
        addressIndex,
        walletSerializer,
        dataStoreService,
      } = arg0.input;

      return await new GetWalletAddressTask(
        internalApi,
        {
          checkOnDevice,
          wallet,
          change,
          addressIndex,
        },
        walletSerializer,
        dataStoreService,
      ).run();
    };
    return {
      getWalletAddress,
      prepareWalletPolicy,
    };
  }
}

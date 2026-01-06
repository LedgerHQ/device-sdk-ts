/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { beforeEach, describe, it, vi } from "vitest";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { UserInputType } from "@api/model/TransactionResolutionContext";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";
import { type SolanaBuildContextResult } from "@internal/app-binder/task/BuildTransactionContextTask";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

const contextModuleStub: ContextModule = {
  getSolanaContext: vi.fn(),
} as unknown as ContextModule;

const makeLoggerService = (): LoggerPublisherService =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: new Map(),
  }) as unknown as LoggerPublisherService;

const loggerFactoryStub: SignTransactionDAInput["loggerFactory"] = vi.fn(() =>
  makeLoggerService(),
);

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getAppConfigMock: ReturnType<typeof vi.fn>;
let buildContextMock: ReturnType<typeof vi.fn>;
let provideContextMock: ReturnType<typeof vi.fn>;
let signMock: ReturnType<typeof vi.fn>;
let inspectTransactionMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    getAppConfig: getAppConfigMock,
    buildContext: buildContextMock,
    provideContext: provideContextMock,
    signTransaction: signMock,
    inspectTransaction: inspectTransactionMock,
  };
}

describe("SignTransactionDeviceAction (Solana)", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    getAppConfigMock = vi.fn();
    buildContextMock = vi.fn();
    provideContextMock = vi.fn();
    signMock = vi.fn();
    inspectTransactionMock = vi.fn().mockResolvedValue({
      transactionType: SolanaTransactionTypes.SPL,
      data: { tokenAddress: null, createATA: false },
    });
  });

  it("happy path (skip open): getAppConfig -> inspect -> build -> provide -> sign", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.4.1" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      const ctx: SolanaBuildContextResult = {
        tlvDescriptor: new Uint8Array([1]),
        trustedNamePKICertificate: {
          keyUsageNumber: 0,
          payload: new Uint8Array([0x01]),
        },
        loadersResults: [],
      };
      buildContextMock.mockResolvedValue(ctx);
      provideContextMock.mockResolvedValue(Nothing);

      const signature = new Uint8Array([0xaa, 0xbb]);
      signMock.mockResolvedValue(
        CommandResultFactory({ data: Just(signature) }),
      );

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: { skipOpenApp: true },
        contextModule: contextModuleStub,
        loggerFactory: loggerFactoryStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // getAppConfig
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        // inspectTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        // buildContext
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // provideContext
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // signTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        // success
        { output: signature, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        Uint8Array,
        SignTransactionDAInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("forwards userInputType to signTransaction dependency", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.4.1" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      const ctx: SolanaBuildContextResult = {
        tlvDescriptor: new Uint8Array([1]),
        trustedNamePKICertificate: {
          keyUsageNumber: 0,
          payload: new Uint8Array([0x01]),
        },
        loadersResults: [],
      };
      buildContextMock.mockResolvedValue(ctx);
      provideContextMock.mockResolvedValue(Nothing);

      const signature = new Uint8Array([0xaa, 0xbb]);
      signMock.mockResolvedValue(
        CommandResultFactory({ data: Just(signature) }),
      );

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          loggerFactory: loggerFactoryStub,
          transactionOptions: {
            skipOpenApp: true,
            transactionResolutionContext: {
              userInputType: UserInputType.ATA,
            } as any,
          },
          contextModule: contextModuleStub,
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // getAppConfig
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        // inspectTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        // buildContext
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // provideContext
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // signTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        // success
        { output: signature, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        Uint8Array,
        SignTransactionDAInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          try {
            expect(signMock).toHaveBeenCalledTimes(1);
            const callArg = signMock.mock.calls[0]?.[0];
            expect(callArg?.input.userInputType).toBe(UserInputType.ATA);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        onError: reject,
      });
    }));

  it("failure in provideContext still signs", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.4.1" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      buildContextMock.mockResolvedValue({
        descriptor: new Uint8Array([2]),
        trustedNamePKICertificate: {
          keyUsageNumber: 0,
          payload: new Uint8Array(),
        },
        challenge: undefined,
        addressResult: { tokenAccount: "", owner: "", contract: "" },
        loadersResults: [],
      });
      provideContextMock.mockResolvedValue(
        Just(
          CommandResultFactory({ error: new InvalidStatusWordError("ctxErr") }),
        ),
      );
      const sig = new Uint8Array([0xfe]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: { skipOpenApp: true },
        contextModule: contextModuleStub,
        loggerFactory: loggerFactoryStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // getAppConfig
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        // inspectTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        // buildContext
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // provideContext (returns error but continues)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // signTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        // success
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        Uint8Array,
        SignTransactionDAInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("buildContext throws → error", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.4.1" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      buildContextMock.mockRejectedValue(new InvalidStatusWordError("bldErr"));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: { skipOpenApp: true },
        contextModule: contextModuleStub,
        loggerFactory: loggerFactoryStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // getAppConfig
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        // inspectTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        // buildContext (throws)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // error raised from buildContext
        {
          error: expect.anything() as unknown as SignTransactionDAError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        Uint8Array,
        SignTransactionDAInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));
});

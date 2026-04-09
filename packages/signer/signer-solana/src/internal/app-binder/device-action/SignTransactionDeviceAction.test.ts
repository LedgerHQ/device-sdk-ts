import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";
import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";
import {
  SOLANA_MIN_DELAYED_SIGNING_VERSION,
  SOLANA_MIN_SPL_VERSION,
} from "@internal/app-binder/SolanaApplicationResolver";
import { type SolanaBuildContextResult } from "@internal/app-binder/task/BuildTransactionContextTask";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { DelayedSignTransactionDeviceAction } from "./DelayedSignTransactionDeviceAction";
import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

const defaultAppConfig: AppConfiguration = {
  blindSigningEnabled: true,
  pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
  version: "2.5.10",
  web3ChecksEnabled: false,
  web3ChecksOptIn: false,
};

const contextModuleStub: ContextModule = {
  getSolanaContext: vi.fn(),
} as unknown as ContextModule;

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getAppConfigMock: ReturnType<typeof vi.fn>;
let web3CheckOptInMock: ReturnType<typeof vi.fn>;
let getPubKeyMock: ReturnType<typeof vi.fn>;
let buildContextMock: ReturnType<typeof vi.fn>;
let provideContextMock: ReturnType<typeof vi.fn>;
let signMock: ReturnType<typeof vi.fn>;
let inspectTransactionMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    getAppConfig: getAppConfigMock,
    web3CheckOptIn: web3CheckOptInMock,
    getPubKey: getPubKeyMock,
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
    web3CheckOptInMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: { enabled: true } }));
    getPubKeyMock = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: "So1anaSignerPubKey111111111111111111111111111",
      }),
    );
    buildContextMock = vi.fn();
    provideContextMock = vi.fn();
    signMock = vi.fn();
    inspectTransactionMock = vi.fn().mockResolvedValue({
      transactionType: SolanaTransactionTypes.SPL,
      data: { tokenAddress: null, createATA: false },
    });
  });

  it("passes transactionOptions.solanaRPCURL to inspectTransaction when it overrides builder solanaRPCURL", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockImplementation(
        async (arg: { rpcUrl?: string }) => {
          expect(arg.rpcUrl).toBe("https://per-call.example.com");
          return {
            transactionType: SolanaTransactionTypes.STANDARD,
          };
        },
      );

      const signature = new Uint8Array([0xaa, 0xbb]);
      signMock.mockResolvedValue(
        CommandResultFactory({ data: Just(signature) }),
      );

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: {
          skipOpenApp: true,
          solanaRPCURL: "https://per-call.example.com",
        },
        solanaRPCURL: "https://builder.example.com",
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: signature, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("happy path (skip open): getAppConfig -> inspect -> build -> provide -> sign", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );
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
      };

      const action = new SignTransactionDeviceAction({
        input,
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
        // getPubKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
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

  it("inspectTransaction rejects, still signs (fallback)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );

      // InspectTransaction fails, machine transitions to SignTransaction
      inspectTransactionMock.mockRejectedValue(
        new InvalidStatusWordError("inspErr"),
      );

      const sig = new Uint8Array([0x11, 0x22]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
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
        // signTransaction (fallback)
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

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          // we should not try to build/provide context if inspection failed
          expect(buildContextMock).not.toHaveBeenCalled();
          expect(provideContextMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("buildContext throws, still signs (fallback)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      // BuildContext fails, machine transitions to SignTransaction
      buildContextMock.mockRejectedValue(new InvalidStatusWordError("bldErr"));

      const sig = new Uint8Array([0xca, 0xfe]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
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
        // getPubKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
          },
          status: DeviceActionStatus.Pending,
        },
        // buildContext (fails, but we still saw the pending step)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // signTransaction (fallback)
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

  it("provideContext rejects, still signs (fallback)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      const ctx: SolanaBuildContextResult = {
        tlvDescriptor: new Uint8Array([0x01]),
        trustedNamePKICertificate: {
          keyUsageNumber: 0,
          payload: new Uint8Array([0x02]),
        },
        loadersResults: [],
      };
      buildContextMock.mockResolvedValue(ctx);

      // ProvideContext rejects, machine transitions to SignTransaction
      provideContextMock.mockRejectedValue(
        new InvalidStatusWordError("provErr"),
      );

      const sig = new Uint8Array([0x33]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
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
        // getPubKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
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
        // signTransaction (fallback)
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

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(buildContextMock).toHaveBeenCalledTimes(1);
          expect(provideContextMock).toHaveBeenCalledTimes(1);
          expect(signMock).toHaveBeenCalledTimes(1);
          resolve();
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
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      buildContextMock.mockResolvedValue({
        tlvDescriptor: new Uint8Array([2]),
        trustedNamePKICertificate: {
          keyUsageNumber: 0,
          payload: new Uint8Array(),
        },
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
      };

      const action = new SignTransactionDeviceAction({
        input,
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
        // getPubKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
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

  it("swap path: SWAP type routes through build -> provide -> sign", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SWAP,
        data: {},
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
        transactionOptions: {
          skipOpenApp: true,
          transactionResolutionContext: {
            templateId: "swap-template-id",
          },
        },
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({
        input,
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
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
          expect(buildContextMock).toHaveBeenCalledTimes(1);
          expect(provideContextMock).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));

  it("buildContext throws → error", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );
      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
      });

      buildContextMock.mockRejectedValue(new InvalidStatusWordError("bldErr"));

      const sig = new Uint8Array([0xab, 0xcd]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: { skipOpenApp: true },
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({
        input,
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
        // getPubKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
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
        // signTransaction (fallback)
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

  it("delayed=true with missing config falls back to legacy sign", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockRejectedValue(
        new InvalidStatusWordError("inspErr"),
      );

      const sig = new Uint8Array([0xdd, 0xee]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: {
          skipOpenApp: true,
          delayed: true,
        },
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it(`delayed=true with app version < ${SOLANA_MIN_DELAYED_SIGNING_VERSION} falls back to legacy sign`, () => {
    const [major, minor, patch] = SOLANA_MIN_DELAYED_SIGNING_VERSION.split(
      ".",
    ).map(Number) as [number, number, number];
    const belowDelayedVersion = `${major}.${minor - 1}.${patch}`;

    return new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: belowDelayedVersion },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockRejectedValue(
        new InvalidStatusWordError("inspErr"),
      );

      const sig = new Uint8Array([0xaa, 0xbb]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: {
          skipOpenApp: true,
          delayed: true,
        },
        solanaRPCURL: "https://api.devnet.solana.com",
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    });
  });

  it(`app version strictly below ${SOLANA_MIN_SPL_VERSION} skips SPL pipeline and signs directly`, () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.9.1" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: defaultAppConfig }),
      );

      const sig = new Uint8Array([0xa1, 0xb2]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: { skipOpenApp: true },
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(inspectTransactionMock).not.toHaveBeenCalled();
          expect(buildContextMock).not.toHaveBeenCalled();
          expect(provideContextMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it(`Nano S skips SPL pipeline regardless of app version`, () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_S,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));

      const sig = new Uint8Array([0xc3, 0xd4]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: { skipOpenApp: true },
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(inspectTransactionMock).not.toHaveBeenCalled();
          expect(buildContextMock).not.toHaveBeenCalled();
          expect(provideContextMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("delayed=false routes to legacy sign (unchanged behavior)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockRejectedValue(
        new InvalidStatusWordError("inspErr"),
      );

      const sig = new Uint8Array([0xff, 0x00]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const input: SignTransactionDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        transactionOptions: {
          skipOpenApp: true,
          delayed: false,
        },
        solanaRPCURL: "https://api.devnet.solana.com",
        contextModule: contextModuleStub,
      };

      const action = new SignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("non-SPL web3checks-supported: inspects then routes to getPubKey -> build -> provide -> sign", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "2.0.0" },
        deviceModelId: DeviceModelId.FLEX,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...defaultAppConfig,
            version: "2.0.0",
            web3ChecksEnabled: true,
            web3ChecksOptIn: true,
          },
        }),
      );

      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.STANDARD,
      });

      buildContextMock.mockResolvedValue({
        loadersResults: [],
      });
      provideContextMock.mockResolvedValue(Nothing);

      const sig = new Uint8Array([0xaa, 0xbb]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: {
            skipOpenApp: true,
          },
          contextModule: contextModuleStub,
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(inspectTransactionMock).toHaveBeenCalledTimes(1);
          expect(getPubKeyMock).toHaveBeenCalledTimes(1);
          expect(buildContextMock).toHaveBeenCalledTimes(1);
          expect(provideContextMock).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));

  it("non-SPL on unsupported device (NANO_X): skips GetPubKey/BuildContext and signs directly", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "2.0.0" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...defaultAppConfig,
            version: "2.0.0",
            web3ChecksEnabled: true,
            web3ChecksOptIn: true,
          },
        }),
      );

      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.STANDARD,
      });

      const sig = new Uint8Array([0xaa, 0xbb]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: {
            skipOpenApp: true,
          },
          contextModule: contextModuleStub,
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: sig, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(inspectTransactionMock).toHaveBeenCalledTimes(1);
          expect(getPubKeyMock).not.toHaveBeenCalled();
          expect(buildContextMock).not.toHaveBeenCalled();
          expect(provideContextMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("Flex: Web3Checks opt-in runs before inspect when app requires it", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "2.0.0" },
        deviceModelId: DeviceModelId.FLEX,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...defaultAppConfig,
            version: "2.0.0",
            web3ChecksEnabled: false,
            web3ChecksOptIn: false,
          },
        }),
      );

      web3CheckOptInMock.mockResolvedValue(
        CommandResultFactory({ data: { enabled: true } }),
      );

      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.STANDARD,
        data: {},
      });

      buildContextMock.mockResolvedValue({
        loadersResults: [],
      });
      provideContextMock.mockResolvedValue(Nothing);

      const sig = new Uint8Array([0x01, 0x02]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
          contextModule: contextModuleStub,
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
            step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN_RESULT,
            result: true,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
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
      >(action, expected, apiMock, {
        onDone: () => {
          expect(web3CheckOptInMock).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));

  it("Flex: Web3Checks opt-in command error proceeds without web3checks", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "2.0.0" },
        deviceModelId: DeviceModelId.FLEX,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...defaultAppConfig,
            version: "2.0.0",
            web3ChecksEnabled: false,
            web3ChecksOptIn: false,
          },
        }),
      );

      web3CheckOptInMock.mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("user declined opt-in"),
        }),
      );

      inspectTransactionMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.STANDARD,
        data: {},
      });

      buildContextMock.mockResolvedValue({
        loadersResults: [],
      });
      provideContextMock.mockResolvedValue(Nothing);

      const sig = new Uint8Array([0x01, 0x02]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
          contextModule: contextModuleStub,
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_APP_CONFIG,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
            step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN_RESULT,
            result: false,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.GET_PUB_KEY,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
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
      >(action, expected, apiMock, {
        onDone: () => {
          expect(web3CheckOptInMock).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));
});

describe("SignTransactionDeviceAction – child machine integration", () => {
  let childExtractDepsSpy: ReturnType<typeof vi.spyOn>;
  let childPreviewMock: ReturnType<typeof vi.fn>;
  let childDelayedSignMock: ReturnType<typeof vi.fn>;
  let childFallbackSignMock: ReturnType<typeof vi.fn>;
  let childFetchBlockhashMock: ReturnType<typeof vi.fn>;
  let childZeroBlockhashMock: ReturnType<typeof vi.fn>;
  let childPatchBlockhashMock: ReturnType<typeof vi.fn>;

  const zeroedTx = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const patchedTx = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const freshBlockhash = new Uint8Array(32).fill(0xab);
  const delayedSig = new Uint8Array([0xcc, 0xdd]);

  function childDeps() {
    return {
      previewTransaction: childPreviewMock,
      delayedSignTransaction: childDelayedSignMock,
      fallbackSignTransaction: childFallbackSignMock,
      fetchBlockhashFn: childFetchBlockhashMock,
      zeroBlockhashFn: childZeroBlockhashMock,
      patchBlockhashFn: childPatchBlockhashMock,
    };
  }

  function delayedInput(): SignTransactionDAInput {
    return {
      derivationPath: defaultDerivation,
      transaction: exampleTx,
      transactionOptions: {
        skipOpenApp: true,
        delayed: true,
      },
      solanaRPCURL: "https://api.devnet.solana.com",
      contextModule: contextModuleStub,
    };
  }

  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.14.0" },
      deviceModelId: DeviceModelId.NANO_X,
      isSecureConnectionAllowed: true,
    });

    getAppConfigMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: {} }));
    buildContextMock = vi.fn();
    provideContextMock = vi.fn();
    signMock = vi.fn();
    inspectTransactionMock = vi
      .fn()
      .mockRejectedValue(new InvalidStatusWordError("inspErr"));

    childPreviewMock = vi.fn();
    childDelayedSignMock = vi.fn();
    childFallbackSignMock = vi.fn();
    childFetchBlockhashMock = vi.fn();
    childZeroBlockhashMock = vi.fn().mockResolvedValue(zeroedTx);
    childPatchBlockhashMock = vi.fn().mockResolvedValue(patchedTx);

    childExtractDepsSpy = vi.spyOn(
      DelayedSignTransactionDeviceAction.prototype,
      "extractDependencies",
    ) as unknown as ReturnType<typeof vi.spyOn>;
    childExtractDepsSpy.mockReturnValue(childDeps());
  });

  afterEach(() => {
    childExtractDepsSpy.mockRestore();
  });

  it("child returns Right(signature) → parent completes with that signature", () =>
    new Promise<void>((resolve, reject) => {
      childPreviewMock.mockResolvedValue(
        CommandResultFactory({ data: Nothing }),
      );
      childFetchBlockhashMock.mockResolvedValue(freshBlockhash);
      childDelayedSignMock.mockResolvedValue(
        CommandResultFactory({ data: Just(delayedSig) }),
      );

      const action = new SignTransactionDeviceAction({
        input: delayedInput(),
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const { observable } = action._execute(apiMock);
      const states: DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[] = [];

      observable.subscribe({
        next: (state) => states.push(state),
        error: reject,
        complete: () => {
          try {
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(delayedSig);
            expect(signMock).not.toHaveBeenCalled();
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
    }));

  it("child returns Left(UnknownDAError) → parent falls back to legacy sign", () =>
    new Promise<void>((resolve, reject) => {
      childPreviewMock.mockResolvedValue(
        CommandResultFactory({ data: Nothing }),
      );
      childFetchBlockhashMock.mockRejectedValue(new Error("network error"));

      const legacySig = new Uint8Array([0xee, 0xff]);
      signMock.mockResolvedValue(
        CommandResultFactory({ data: Just(legacySig) }),
      );

      const action = new SignTransactionDeviceAction({
        input: delayedInput(),
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const { observable } = action._execute(apiMock);
      const states: DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[] = [];

      observable.subscribe({
        next: (state) => states.push(state),
        error: reject,
        complete: () => {
          try {
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(legacySig);
            expect(signMock).toHaveBeenCalled();
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
    }));

  it("child returns Left(SolanaAppCommandError) for user rejection → parent errors", () =>
    new Promise<void>((resolve, reject) => {
      childPreviewMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            errorCode: "6985",
            message: "Canceled by user",
          }),
        }),
      );

      const action = new SignTransactionDeviceAction({
        input: delayedInput(),
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const { observable } = action._execute(apiMock);
      const states: DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[] = [];

      observable.subscribe({
        next: (state) => states.push(state),
        error: reject,
        complete: () => {
          try {
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Error);
            expect(signMock).not.toHaveBeenCalled();
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
    }));
});

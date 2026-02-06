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
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { BlindSignReason } from "@internal/app-binder/services/computeSigningContext";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";
import { type SolanaBuildContextResult } from "@internal/app-binder/task/BuildTransactionContextTask";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const contextModuleStub: ContextModule = {
  getSolanaContext: vi.fn(),
} as unknown as ContextModule;

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

/** Helper to create a recognized-programs-only inspector result */
function makeInspectorResult(
  overrides: Partial<{
    transactionType: SolanaTransactionTypes;
    programIds: string[];
    instructionCount: number;
    usesAddressLookupTables: boolean;
    data: Record<string, unknown>;
  }> = {},
) {
  return {
    transactionType:
      overrides.transactionType ?? SolanaTransactionTypes.STANDARD,
    data: overrides.data ?? {},
    programIds: overrides.programIds ?? [
      "11111111111111111111111111111111",
    ],
    instructionCount: overrides.instructionCount ?? 1,
    usesAddressLookupTables: overrides.usesAddressLookupTables ?? false,
  };
}

describe("SignTransactionDeviceAction (Solana)", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    getAppConfigMock = vi.fn();
    buildContextMock = vi.fn();
    provideContextMock = vi.fn();
    signMock = vi.fn();
    inspectTransactionMock = vi.fn().mockResolvedValue(
      makeInspectorResult({ transactionType: SolanaTransactionTypes.SPL }),
    );
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
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.SPL,
          programIds: [
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          ],
          instructionCount: 2,
        }),
      );

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
        loggerFactory: mockLoggerFactory,
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
            signingContext: {
              isBlindSign: false,
              reason: BlindSignReason.None,
              programIds: [
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
              ],
              unrecognizedPrograms: [],
              instructionCount: 2,
            },
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

  it("inspectTransaction rejects, still signs (fallback) with isBlindSign: true", () =>
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
        loggerFactory: mockLoggerFactory,
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
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.InspectionFailed,
              programIds: [],
              unrecognizedPrograms: [],
              instructionCount: 0,
            },
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

  it("buildContext throws, still signs with isBlindSign: true (context_build_failed)", () =>
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
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.SPL,
          programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
          instructionCount: 1,
        }),
      );

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
        loggerFactory: mockLoggerFactory,
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
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.ContextBuildFailed,
              programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
              unrecognizedPrograms: [],
              instructionCount: 1,
            },
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

  it("provideContext rejects, still signs with isBlindSign: true (context_provision_failed)", () =>
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
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.SPL,
          programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
          instructionCount: 1,
        }),
      );

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
        loggerFactory: mockLoggerFactory,
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
        // signTransaction (fallback)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.ContextProvisionFailed,
              programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
              unrecognizedPrograms: [],
              instructionCount: 1,
            },
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
        currentApp: { name: "Solana", version: "1.4.1" },
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: true,
      });

      getAppConfigMock.mockResolvedValue(CommandResultFactory({ data: {} }));
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.SPL,
          programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
          instructionCount: 1,
        }),
      );

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
        loggerFactory: mockLoggerFactory,
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
        // provideContext (returns error but continues via onDone, not onError)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
          },
          status: DeviceActionStatus.Pending,
        },
        // signTransaction — provideContext resolved (not rejected), so no reason update
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
            signingContext: {
              isBlindSign: false,
              reason: BlindSignReason.None,
              programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
              unrecognizedPrograms: [],
              instructionCount: 1,
            },
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
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.SPL,
          programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
          instructionCount: 1,
        }),
      );

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
        loggerFactory: mockLoggerFactory,
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
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.ContextBuildFailed,
              programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
              unrecognizedPrograms: [],
              instructionCount: 1,
            },
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

  it("unrecognized program triggers isBlindSign: true", () =>
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

      const jupiterProgramId = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.STANDARD,
          programIds: [
            "11111111111111111111111111111111",
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            jupiterProgramId,
          ],
          instructionCount: 4,
        }),
      );

      const sig = new Uint8Array([0xdd]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
          contextModule: contextModuleStub,
        },
        loggerFactory: mockLoggerFactory,
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
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.UnrecognizedProgram,
              programIds: [
                "11111111111111111111111111111111",
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                jupiterProgramId,
              ],
              unrecognizedPrograms: [jupiterProgramId],
              instructionCount: 4,
            },
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

  it("too many instructions (>6) triggers isBlindSign: true", () =>
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
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.STANDARD,
          programIds: ["11111111111111111111111111111111"],
          instructionCount: 7,
        }),
      );

      const sig = new Uint8Array([0xee]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
          contextModule: contextModuleStub,
        },
        loggerFactory: mockLoggerFactory,
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
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.TooManyInstructions,
              programIds: ["11111111111111111111111111111111"],
              unrecognizedPrograms: [],
              instructionCount: 7,
            },
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

  it("descriptor-based signing: provideContext success clears isBlindSign when reason was UnrecognizedProgram", () =>
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

      // SPL transaction that also contains an unrecognized program (e.g. Jupiter inside a swap)
      const jupiterProgramId = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.SPL,
          programIds: [
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            jupiterProgramId,
          ],
          instructionCount: 3,
        }),
      );

      const ctx: SolanaBuildContextResult = {
        tlvDescriptor: new Uint8Array([0x01]),
        trustedNamePKICertificate: {
          keyUsageNumber: 0,
          payload: new Uint8Array([0x02]),
        },
        loadersResults: [],
      };
      buildContextMock.mockResolvedValue(ctx);
      provideContextMock.mockResolvedValue(Nothing);

      const sig = new Uint8Array([0xa1]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
          contextModule: contextModuleStub,
        },
        loggerFactory: mockLoggerFactory,
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
        // signTransaction — descriptors provided, so device uses process_message_body_with_descriptor()
        // which bypasses the program whitelist → isBlindSign cleared
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
            signingContext: {
              isBlindSign: false,
              reason: BlindSignReason.None,
              programIds: [
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                jupiterProgramId,
              ],
              unrecognizedPrograms: [jupiterProgramId],
              instructionCount: 3,
            },
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
        onDone: resolve,
        onError: reject,
      });
    }));

  it("descriptor-based signing: provideContext success does NOT clear isBlindSign when reason is AddressLookupTables", () =>
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

      // SPL transaction with ALTs — structural issue that descriptors don't bypass
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.SPL,
          programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
          instructionCount: 2,
          usesAddressLookupTables: true,
        }),
      );

      const ctx: SolanaBuildContextResult = {
        tlvDescriptor: new Uint8Array([0x01]),
        trustedNamePKICertificate: {
          keyUsageNumber: 0,
          payload: new Uint8Array([0x02]),
        },
        loadersResults: [],
      };
      buildContextMock.mockResolvedValue(ctx);
      provideContextMock.mockResolvedValue(Nothing);

      const sig = new Uint8Array([0xb2]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
          contextModule: contextModuleStub,
        },
        loggerFactory: mockLoggerFactory,
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
        // signTransaction — ALTs are structural, descriptors don't bypass this → isBlindSign stays true
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: signTransactionDAStateSteps.SIGN_TRANSACTION,
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.AddressLookupTables,
              programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
              unrecognizedPrograms: [],
              instructionCount: 2,
            },
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
        onDone: resolve,
        onError: reject,
      });
    }));

  it("address lookup tables trigger isBlindSign: true", () =>
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
      inspectTransactionMock.mockResolvedValue(
        makeInspectorResult({
          transactionType: SolanaTransactionTypes.STANDARD,
          programIds: ["11111111111111111111111111111111"],
          instructionCount: 2,
          usesAddressLookupTables: true,
        }),
      );

      const sig = new Uint8Array([0xff]);
      signMock.mockResolvedValue(CommandResultFactory({ data: Just(sig) }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          transactionOptions: { skipOpenApp: true },
          contextModule: contextModuleStub,
        },
        loggerFactory: mockLoggerFactory,
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
            signingContext: {
              isBlindSign: true,
              reason: BlindSignReason.AddressLookupTables,
              programIds: ["11111111111111111111111111111111"],
              unrecognizedPrograms: [],
              instructionCount: 2,
            },
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
});

import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signClearSignDAStateSteps } from "@api/app-binder/SignClearSignDeviceActionTypes";
import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";
import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  SEND_WITH_MEMO_MESSAGE,
  UNSTAKE_MESSAGE,
  withOneSignature,
} from "@internal/app-binder/services/__test-utils__/ambiguousMessages";
import {
  SPEC_V1_MESSAGE,
  withByte,
  withTrailingBytes,
} from "@internal/app-binder/services/__test-utils__/v1Fixtures";
import { TransactionInputNormaliser } from "@internal/app-binder/services/TransactionInputNormaliser";
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";
import {
  SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION,
  SOLANA_MIN_TRANSACTION_CHECKS_VERSION,
  SOLANA_MIN_V1_TRANSACTIONS_VERSION,
} from "@internal/app-binder/SolanaApplicationResolver";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { ProvisionBasicClearSignDeviceAction } from "./ProvisionBasicClearSignDeviceAction";
import { ProvisionGenericClearSignDeviceAction } from "./ProvisionGenericClearSignDeviceAction";
import { ProvisionTransactionCheckDeviceAction } from "./ProvisionTransactionCheckDeviceAction";
import { SignBasicClearSignDeviceAction } from "./SignBasicClearSignDeviceAction";
import { SignGenericClearSignDeviceAction } from "./SignGenericClearSignDeviceAction";
import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

/**
 * The parent is a thin orchestrator: setup (open app / config / web3 opt-in),
 * then the gate, then the generic clear-sign machine and/or basic clear-sign
 * machine, then the (delayed) terminal-sign machine. These tests cover the
 * orchestration only;
 * each child machine's behaviour is covered by its own test file.
 */

const defaultDerivation = "44'/501'/0'/0'";
// A real legacy message: the orchestrator reads its version from the first
// byte, so the example must not look like an unknown versioned message.
const exampleTx = UNSTAKE_MESSAGE;
const signature = new Uint8Array([0xaa, 0xbb]);
const armedSig = new Uint8Array([0x77, 0x88]);

// Below the generic-clear-sign min version, so the gate routes to the basic
// path; still supports spl / delayed / web3.
const legacyVersion = "1.15.5";

const contextModuleStub = {
  getContexts: vi.fn(),
} as unknown as ContextModule;

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getAppConfigMock: ReturnType<typeof vi.fn>;

// Generic clear-sign (prepare) child deps
let buildGenericMock: ReturnType<typeof vi.fn>;
let provideGenericMock: ReturnType<typeof vi.fn>;
let finalizeMock: ReturnType<typeof vi.fn>;
// Basic clear-sign (provision) child deps
let inspectMock: ReturnType<typeof vi.fn>;
let buildBasicMock: ReturnType<typeof vi.fn>;
let provideBasicMock: ReturnType<typeof vi.fn>;
// Transaction-check (web3 checks) child deps
let txCheckOptInMock: ReturnType<typeof vi.fn>;
let provideTxCheckMock: ReturnType<typeof vi.fn>;
// Reporting
let reportSignMock: ReturnType<typeof vi.fn>;
// Basic-flow routing
let resolveSigningRouteMock: ReturnType<typeof vi.fn>;
// Terminal sign-op deps (generic + basic) and the shared refresh task
let promptUiDisplayMock: ReturnType<typeof vi.fn>;
let previewMock: ReturnType<typeof vi.fn>;
let delayedSignMock: ReturnType<typeof vi.fn>;
let signMock: ReturnType<typeof vi.fn>;
let refreshBlockhashMock: ReturnType<typeof vi.fn>;

let parentSpy: ReturnType<typeof vi.spyOn>;
let genericSpy: ReturnType<typeof vi.spyOn>;
let basicSpy: ReturnType<typeof vi.spyOn>;
let txCheckSpy: ReturnType<typeof vi.spyOn>;
let genericSignSpy: ReturnType<typeof vi.spyOn>;
let basicSignSpy: ReturnType<typeof vi.spyOn>;

function appConfig(version: string): AppConfiguration {
  return {
    blindSigningEnabled: true,
    pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
    version,
    transactionChecksEnabled: false,
    transactionChecksOptIn: false,
  };
}

function session(
  version: string,
  deviceModelId = DeviceModelId.NANO_X,
  appName = "Solana",
) {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: appName, version },
    deviceModelId,
    isSecureConnectionAllowed: true,
  };
}

function spyChildren() {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  genericSpy = vi
    .spyOn(
      ProvisionGenericClearSignDeviceAction.prototype,
      "extractDependencies",
    )
    .mockReturnValue({
      buildGenericClearSignContext: buildGenericMock,
      provideGenericClearSignContext: provideGenericMock,
      finalizeGenericClearSign: finalizeMock,
    } as any) as any;
  basicSpy = vi
    .spyOn(ProvisionBasicClearSignDeviceAction.prototype, "extractDependencies")
    .mockReturnValue({
      inspectTransaction: inspectMock,
      buildBasicClearSignContext: buildBasicMock,
      provideBasicClearSignContext: provideBasicMock,
    } as any) as any;
  txCheckSpy = vi
    .spyOn(
      ProvisionTransactionCheckDeviceAction.prototype,
      "extractDependencies",
    )
    .mockReturnValue({
      transactionCheckOptIn: txCheckOptInMock,
      provideTransactionCheck: provideTxCheckMock,
    } as any) as any;
  genericSignSpy = vi
    .spyOn(SignGenericClearSignDeviceAction.prototype, "extractDependencies")
    .mockReturnValue({
      promptUiDisplay: promptUiDisplayMock,
      refreshBlockhash: refreshBlockhashMock,
      delayedSignTransaction: delayedSignMock,
    } as any) as any;
  basicSignSpy = vi
    .spyOn(SignBasicClearSignDeviceAction.prototype, "extractDependencies")
    .mockReturnValue({
      previewTransaction: previewMock,
      refreshBlockhash: refreshBlockhashMock,
      delayedSignTransaction: delayedSignMock,
      signTransaction: signMock,
    } as any) as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function run(
  input: SignTransactionDAInput,
  onComplete: (
    states: DeviceActionState<
      Uint8Array,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new SignTransactionDeviceAction({ input });
  parentSpy = vi.spyOn(action, "extractDependencies").mockReturnValue({
    normalizeTransaction: vi.fn().mockResolvedValue({
      messageBytes: input.transaction,
      serializedForTxCheck: undefined,
    }),
    getAppConfig: getAppConfigMock,
    reportSign: reportSignMock,
    resolveSigningRoute: resolveSigningRouteMock,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as unknown as ReturnType<typeof vi.spyOn>;
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    Uint8Array,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

const baseInput: SignTransactionDAInput = {
  derivationPath: defaultDerivation,
  transaction: exampleTx,
  transactionOptions: { skipOpenApp: true },
  contextModule: contextModuleStub,
};
const withRpc: SignTransactionDAInput = {
  ...baseInput,
  solanaRPCURL: "https://api.devnet.solana.com",
};
// Blockhash refresh is opt-in: an RPC source alone is not enough, the caller
// must also request `delayed: true`.
const withRpcDelayed: SignTransactionDAInput = {
  ...withRpc,
  transactionOptions: { ...baseInput.transactionOptions, delayed: true },
};

// The ordered list of distinct steps a consumer observes. Consecutive repeats
// (the Pending re-emitted at each child-machine boundary) are collapsed: they
// carry the same step, so the meaningful contract is the step progression.
function stepSequence(
  states: DeviceActionState<
    Uint8Array,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue
  >[],
): string[] {
  const steps: string[] = [];
  for (const s of states) {
    if (s.status !== DeviceActionStatus.Pending) continue;
    const step = s.intermediateValue.step;
    if (steps[steps.length - 1] !== step) steps.push(step);
  }
  return steps;
}

describe("SignTransactionDeviceAction (Solana) – orchestration", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    apiMock.getDeviceSessionState.mockReturnValue(session(legacyVersion));
    getAppConfigMock = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({ data: appConfig(legacyVersion) }),
      );
    // Generic child: degrades by default (no instruction recognised).
    buildGenericMock = vi.fn().mockResolvedValue({
      mode: "none",
      poolContexts: [],
      instructionInfoContexts: [],
      unrecognizedProgramIds: [],
    });
    provideGenericMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: undefined }));
    finalizeMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: undefined }));
    promptUiDisplayMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: undefined }));

    // Basic child: provisions successfully by default.
    inspectMock = vi
      .fn()
      .mockResolvedValue({ transactionType: SolanaTransactionTypes.STANDARD });
    buildBasicMock = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { loadersResults: [], contextErrorCount: 0 },
      }),
    );
    provideBasicMock = vi.fn().mockResolvedValue(undefined);

    // Terminal/delayed child: every path resolves to a signature.
    previewMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: Nothing }));
    // Best-effort refresh task: echoes the original tx (its output only feeds
    // the terminal sign here; the per-machine tests cover patched bytes).
    refreshBlockhashMock = vi
      .fn()
      .mockImplementation(async (arg) => arg.input.transaction);
    delayedSignMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: Just(armedSig) }));
    signMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: Just(signature) }));

    txCheckOptInMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: { enabled: true } }));
    provideTxCheckMock = vi.fn().mockResolvedValue(undefined);

    reportSignMock = vi.fn().mockResolvedValue(undefined);

    // No basic-flow rule matches by default.
    resolveSigningRouteMock = vi.fn().mockResolvedValue(null);

    spyChildren();
  });

  afterEach(() => {
    parentSpy?.mockRestore();
    genericSpy.mockRestore();
    basicSpy.mockRestore();
    txCheckSpy.mockRestore();
    genericSignSpy.mockRestore();
    basicSignSpy.mockRestore();
  });

  it("generic unavailable then basic provisions then terminal one-shot sign (no RPC)", () =>
    new Promise<void>((resolve, reject) => {
      run(
        baseInput,
        (states) => {
          try {
            expect(buildGenericMock).not.toHaveBeenCalled();
            expect(inspectMock).toHaveBeenCalled();
            // No RPC then terminal one-shot (0x06), no delayed sign.
            expect(signMock).toHaveBeenCalled();
            expect(delayedSignMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(signature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("generic available + armed then terminal delayed sign (alreadyArmed, refreshed)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        }),
      );
      buildGenericMock.mockResolvedValue({
        mode: "full",
        poolContexts: [],
        instructionInfoContexts: [],

        unrecognizedProgramIds: [],
      });
      run(
        withRpcDelayed,
        (states) => {
          try {
            expect(buildGenericMock).toHaveBeenCalled();
            expect(promptUiDisplayMock).toHaveBeenCalled();
            // Prepared + delayed then terminal refreshes blockhash and
            // delayed-signs (no preview).
            expect(previewMock).not.toHaveBeenCalled();
            expect(refreshBlockhashMock).toHaveBeenCalled();
            expect(
              refreshBlockhashMock.mock.calls[0]![0].input.rpcUrl,
            ).toBeDefined();
            expect(delayedSignMock).toHaveBeenCalled();
            // Basic path not taken.
            expect(inspectMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(armedSig);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("generic available + armed, RPC but no delayed then delayed sign on original (no refresh)", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        }),
      );
      buildGenericMock.mockResolvedValue({
        mode: "full",
        poolContexts: [],
        instructionInfoContexts: [],

        unrecognizedProgramIds: [],
      });
      // withRpc (no delayed): the armed device still terminates on SIGN
      // MESSAGE DELAYED (0x09), but signs the original blockhash — no refresh.
      run(
        withRpc,
        (states) => {
          try {
            expect(promptUiDisplayMock).toHaveBeenCalled();
            expect(previewMock).not.toHaveBeenCalled();
            // Refresh is withheld (no `delayed`): the source is not forwarded,
            // so the task signs the original blockhash.
            expect(
              refreshBlockhashMock.mock.calls[0]![0].input.rpcUrl,
            ).toBeUndefined();
            expect(delayedSignMock).toHaveBeenCalled();
            expect(signMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(armedSig);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("not armed, RPC but no delayed then terminal one-shot sign (no refresh)", () =>
    new Promise<void>((resolve, reject) => {
      // Generic unavailable on legacyVersion then basic then terminal. With an RPC
      // source but no `delayed: true`, refresh is withheld: one-shot 0x06.
      run(
        withRpc,
        (states) => {
          try {
            expect(signMock).toHaveBeenCalled();
            expect(previewMock).not.toHaveBeenCalled();
            expect(refreshBlockhashMock).not.toHaveBeenCalled();
            expect(delayedSignMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(signature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("Exchange context disables delayed signing so the payout is signed once (no preview, no refresh)", () =>
    new Promise<void>((resolve, reject) => {
      // Solana inside Exchange: delayed signing is excluded, so even with
      // delayed: true and an RPC the original blockhash is signed with 0x06.
      const swapVersion = SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION;
      apiMock.getDeviceSessionState.mockReturnValue(
        session(swapVersion, DeviceModelId.FLEX, "Exchange"),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: appConfig(swapVersion) }),
      );
      run(
        withRpcDelayed,
        (states) => {
          try {
            expect(signMock).toHaveBeenCalledTimes(1);
            expect(
              signMock.mock.calls[0]![0].input.serializedTransaction,
            ).toStrictEqual(exampleTx);
            expect(previewMock).not.toHaveBeenCalled();
            expect(refreshBlockhashMock).not.toHaveBeenCalled();
            expect(delayedSignMock).not.toHaveBeenCalled();
            expect(buildGenericMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(signature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("delayed requested + RPC but app lacks delayed-signing then one-shot sign (refresh withheld)", () =>
    new Promise<void>((resolve, reject) => {
      // 1.13.0 < SOLANA_MIN_DELAYED_SIGNING_VERSION (1.14.0): the capability
      // gate fails, so even with `delayed: true` + RPC the source is withheld
      // and the terminal signs one-shot (0x06) on the original.
      const preDelayedVersion = "1.13.0";
      apiMock.getDeviceSessionState.mockReturnValue(session(preDelayedVersion));
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({ data: appConfig(preDelayedVersion) }),
      );
      run(
        withRpcDelayed,
        (states) => {
          try {
            expect(signMock).toHaveBeenCalled();
            expect(previewMock).not.toHaveBeenCalled();
            expect(refreshBlockhashMock).not.toHaveBeenCalled();
            expect(delayedSignMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(signature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("generic degraded then basic then terminal", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        }),
      );
      // buildGenericMock default then mode "none" then degraded.
      run(
        withRpcDelayed,
        (states) => {
          try {
            expect(buildGenericMock).toHaveBeenCalled();
            expect(inspectMock).toHaveBeenCalled(); // basic ran
            // RPC + delayed, not armed then terminal does the legacy delayed flow.
            expect(previewMock).toHaveBeenCalled();
            expect(delayedSignMock).toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("generic user cancel (6985) then error, no basic / no terminal", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        }),
      );
      buildGenericMock.mockResolvedValue({
        mode: "full",
        poolContexts: [],
        instructionInfoContexts: [],

        unrecognizedProgramIds: [],
      });
      promptUiDisplayMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6985", message: "Canceled by user" } as any),
          }),
        }),
      );
      run(
        withRpc,
        (states) => {
          try {
            expect(inspectMock).not.toHaveBeenCalled();
            expect(delayedSignMock).not.toHaveBeenCalled();
            expect(signMock).not.toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Error,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("terminal sign failure then error", () =>
    new Promise<void>((resolve, reject) => {
      signMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6f01", message: "sign failed" } as any),
          }),
        }),
      );
      run(
        baseInput,
        (states) => {
          try {
            expect(signMock).toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Error,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("getAppConfig error then error", () =>
    new Promise<void>((resolve, reject) => {
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6e00", message: "no app config" } as any),
          }),
        }),
      );
      run(
        baseInput,
        (states) => {
          try {
            expect(inspectMock).not.toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Error,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("ProvisionTransactionCheckDeviceAction child is invoked when feature is supported", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_TRANSACTION_CHECKS_VERSION, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(SOLANA_MIN_TRANSACTION_CHECKS_VERSION),
            transactionChecksEnabled: true,
            transactionChecksOptIn: true,
          },
        }),
      );
      run(
        baseInput,
        (states) => {
          try {
            const steps = stepSequence(states);
            expect(steps).toContain(
              signTransactionDAStateSteps.TRANSACTION_CHECKS_PROVIDE,
            );
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("skips transaction-checks when transactionChecks is in disabledFeatures", () =>
    new Promise<void>((resolve, reject) => {
      // App supports TXC on Flex, but the caller force-disables it.
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_TRANSACTION_CHECKS_VERSION, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(SOLANA_MIN_TRANSACTION_CHECKS_VERSION),
            transactionChecksEnabled: false,
            transactionChecksOptIn: false,
          },
        }),
      );
      run(
        { ...baseInput, disabledFeatures: ["transactionChecks"] },
        (states) => {
          try {
            const steps = stepSequence(states);
            expect(steps).not.toContain(
              signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN,
            );
            expect(steps).not.toContain(
              signTransactionDAStateSteps.TRANSACTION_CHECKS_PROVIDE,
            );
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  describe("transaction-check re-provision after a generic fallback", () => {
    // Flex supports both web3 checks and generic clear-sign at this version.
    const txcAndGeneric = SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION;

    function withTxcAndGeneric(config: Partial<AppConfiguration>) {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(txcAndGeneric, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: { ...appConfig(txcAndGeneric), ...config },
        }),
      );
    }

    const armedGeneric = {
      mode: "full",
      poolContexts: [],
      instructionInfoContexts: [],
      unrecognizedProgramIds: [],
    };

    it("generic degraded → tx-check provided again before basic", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric({
          transactionChecksEnabled: true,
          transactionChecksOptIn: true,
        });
        // buildGenericMock default → mode "none" → degraded.
        run(
          baseInput,
          (states) => {
            try {
              expect(buildGenericMock).toHaveBeenCalled();
              expect(provideTxCheckMock).toHaveBeenCalledTimes(2);
              expect(txCheckOptInMock).not.toHaveBeenCalled();
              // Re-provision happens after generic, before basic.
              expect(
                provideTxCheckMock.mock.invocationCallOrder[1]!,
              ).toBeGreaterThan(buildGenericMock.mock.invocationCallOrder[0]!);
              expect(
                provideTxCheckMock.mock.invocationCallOrder[1]!,
              ).toBeLessThan(inspectMock.mock.invocationCallOrder[0]!);
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("generic prompt failure (non-cancel) → tx-check provided again before basic", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric({
          transactionChecksEnabled: true,
          transactionChecksOptIn: true,
        });
        buildGenericMock.mockResolvedValue(armedGeneric);
        promptUiDisplayMock.mockResolvedValue(
          CommandResultFactory({
            error: new SolanaAppCommandError({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...({ errorCode: "6a80", message: "bad descriptor" } as any),
            }),
          }),
        );
        run(
          baseInput,
          (states) => {
            try {
              expect(promptUiDisplayMock).toHaveBeenCalled();
              expect(provideTxCheckMock).toHaveBeenCalledTimes(2);
              expect(
                provideTxCheckMock.mock.invocationCallOrder[1]!,
              ).toBeGreaterThan(
                promptUiDisplayMock.mock.invocationCallOrder[0]!,
              );
              expect(inspectMock).toHaveBeenCalled();
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("opt-in accepted on first pass → re-provision does not prompt again", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric({
          transactionChecksEnabled: false,
          transactionChecksOptIn: false,
        });
        run(
          baseInput,
          (states) => {
            try {
              expect(txCheckOptInMock).toHaveBeenCalledTimes(1);
              expect(provideTxCheckMock).toHaveBeenCalledTimes(2);
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("opt-in declined on first pass → no prompt and no provide on fallback", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric({
          transactionChecksEnabled: false,
          transactionChecksOptIn: false,
        });
        txCheckOptInMock.mockResolvedValue(
          CommandResultFactory({ data: { enabled: false } }),
        );
        run(
          baseInput,
          (states) => {
            try {
              expect(txCheckOptInMock).toHaveBeenCalledTimes(1);
              expect(provideTxCheckMock).not.toHaveBeenCalled();
              expect(inspectMock).toHaveBeenCalled();
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("generic prepared + signed → tx-check provided once", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric({
          transactionChecksEnabled: true,
          transactionChecksOptIn: true,
        });
        buildGenericMock.mockResolvedValue(armedGeneric);
        run(
          baseInput,
          (states) => {
            try {
              expect(provideTxCheckMock).toHaveBeenCalledTimes(1);
              expect(inspectMock).not.toHaveBeenCalled();
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("generic unavailable → tx-check provided once before basic", () =>
      new Promise<void>((resolve, reject) => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_TRANSACTION_CHECKS_VERSION, DeviceModelId.FLEX),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              ...appConfig(SOLANA_MIN_TRANSACTION_CHECKS_VERSION),
              transactionChecksEnabled: true,
              transactionChecksOptIn: true,
            },
          }),
        );
        run(
          baseInput,
          (states) => {
            try {
              expect(buildGenericMock).not.toHaveBeenCalled();
              expect(provideTxCheckMock).toHaveBeenCalledTimes(1);
              expect(inspectMock).toHaveBeenCalled();
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));
  });

  // End-to-end emitted-step-sequence contracts (the progression a consumer sees).
  it("e2e sequence: legacy SPL path with RPC then basic provisioning then delayed terminal", () =>
    new Promise<void>((resolve, reject) => {
      inspectMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
        data: { tokenAddress: null, createATA: false },
      });
      run(
        withRpcDelayed,
        (states) => {
          try {
            expect(stepSequence(states)).toEqual([
              signTransactionDAStateSteps.GET_APP_CONFIG,
              signTransactionDAStateSteps.INSPECT_TRANSACTION,
              signTransactionDAStateSteps.BUILD_BASIC_CLEAR_SIGN_CONTEXT,
              signTransactionDAStateSteps.PROVIDE_BASIC_CLEAR_SIGN_CONTEXT,
              signClearSignDAStateSteps.PREVIEW_TRANSACTION,
              signClearSignDAStateSteps.FETCH_BLOCKHASH,
              signClearSignDAStateSteps.DELAYED_SIGN,
            ]);
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("e2e sequence: generic clear-sign armed then terminal refresh + delayed sign", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        }),
      );
      buildGenericMock.mockResolvedValue({
        mode: "full",
        poolContexts: [],
        instructionInfoContexts: [],

        unrecognizedProgramIds: [],
      });
      run(
        withRpcDelayed,
        (states) => {
          try {
            expect(stepSequence(states)).toEqual([
              signTransactionDAStateSteps.GET_APP_CONFIG,
              signTransactionDAStateSteps.BUILD_GENERIC_CLEAR_SIGN_CONTEXT,
              signTransactionDAStateSteps.PROVIDE_GENERIC_CLEAR_SIGN_CONTEXT,
              signTransactionDAStateSteps.FINALIZE_GENERIC_CLEAR_SIGN,
              signClearSignDAStateSteps.PROMPT_UI_DISPLAY,
              signClearSignDAStateSteps.FETCH_BLOCKHASH,
              signClearSignDAStateSteps.DELAYED_SIGN,
            ]);
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toEqual(armedSig);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  describe("Report state — isBlindSign contract", () => {
    it("legacy path (generic gate skipped) → isBlindSign: true, reportSign called once", () =>
      new Promise<void>((resolve, reject) => {
        // Default: legacyVersion < SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION → gate
        // routes straight to BasicClearSign without arming the generic child.
        run(
          baseInput,
          () => {
            try {
              expect(reportSignMock).toHaveBeenCalledOnce();
              const callArg = reportSignMock.mock.calls[0]![0] as {
                input: { isBlindSign: boolean };
              };
              expect(callArg.input.isBlindSign).toBe(true);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("generic clear-sign success → isBlindSign: false, reportSign called once", () =>
      new Promise<void>((resolve, reject) => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
          }),
        );
        buildGenericMock.mockResolvedValue({
          mode: "full",
          poolContexts: [],
          instructionInfoContexts: [],
          unrecognizedProgramIds: [],
        });
        run(
          withRpcDelayed,
          () => {
            try {
              expect(reportSignMock).toHaveBeenCalledOnce();
              const callArg = reportSignMock.mock.calls[0]![0] as {
                input: { isBlindSign: boolean };
              };
              expect(callArg.input.isBlindSign).toBe(false);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("generic cancel (6985) → isBlindSign: false, reportSign called once", () =>
      new Promise<void>((resolve, reject) => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
          }),
        );
        buildGenericMock.mockResolvedValue({
          mode: "full",
          poolContexts: [],
          instructionInfoContexts: [],
          unrecognizedProgramIds: [],
        });
        promptUiDisplayMock.mockResolvedValue(
          CommandResultFactory({
            error: new SolanaAppCommandError({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...({ errorCode: "6985", message: "Canceled by user" } as any),
            }),
          }),
        );
        run(
          withRpc,
          () => {
            try {
              expect(reportSignMock).toHaveBeenCalledOnce();
              const callArg = reportSignMock.mock.calls[0]![0] as {
                input: { isBlindSign: boolean };
              };
              expect(callArg.input.isBlindSign).toBe(false);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("generic non-cancel prompt failure degrades to basic → isBlindSign: true, reportSign called once", () =>
      new Promise<void>((resolve, reject) => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
          }),
        );
        buildGenericMock.mockResolvedValue({
          mode: "full",
          poolContexts: [],
          instructionInfoContexts: [],
          unrecognizedProgramIds: [],
        });
        // A non-cancel UI failure causes the child to return Right("degraded"),
        // leaving signature and error unset → BasicClearSign → Report.
        promptUiDisplayMock.mockResolvedValue(
          CommandResultFactory({
            error: new SolanaAppCommandError({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...({ errorCode: "6f01", message: "Display error" } as any),
            }),
          }),
        );
        run(
          withRpc,
          () => {
            try {
              expect(reportSignMock).toHaveBeenCalledOnce();
              const callArg = reportSignMock.mock.calls[0]![0] as {
                input: { isBlindSign: boolean };
              };
              expect(callArg.input.isBlindSign).toBe(true);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("generic build degrades with staleDescriptor → reportSign receives staleDescriptor: true", () =>
      new Promise<void>((resolve, reject) => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
          }),
        );
        // ACCOUNT_SCHEMA mismatch: build degrades to mode "none" and flags
        // staleDescriptor, so the child never gets past CheckContextRecognised
        // and control falls straight through to BasicClearSign → Report.
        buildGenericMock.mockResolvedValue({
          mode: "none",
          poolContexts: [],
          instructionInfoContexts: [],
          unrecognizedProgramIds: [],
          staleDescriptor: true,
        });
        run(
          withRpc,
          () => {
            try {
              expect(reportSignMock).toHaveBeenCalledOnce();
              const callArg = reportSignMock.mock.calls[0]![0] as {
                input: { isBlindSign: boolean; staleDescriptor: boolean };
              };
              expect(callArg.input.isBlindSign).toBe(true);
              expect(callArg.input.staleDescriptor).toBe(true);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("basic-flow rule match → isBlindSign: false, reportSign called once", () =>
      new Promise<void>((resolve, reject) => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
          }),
        );
        resolveSigningRouteMock.mockResolvedValue("native-staking");
        run(
          baseInput,
          () => {
            try {
              expect(reportSignMock).toHaveBeenCalledOnce();
              const callArg = reportSignMock.mock.calls[0]![0] as {
                input: { isBlindSign: boolean };
              };
              expect(callArg.input.isBlindSign).toBe(false);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));
  });

  describe("basic-flow routing", () => {
    // Flex supports both web3 checks and generic clear-sign at this version.
    function withTxcAndGeneric() {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
            transactionChecksEnabled: true,
            transactionChecksOptIn: true,
          },
        }),
      );
    }

    it("rule match → TxCheck then basic, skipping generic and the tx-check re-provision", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric();
        resolveSigningRouteMock.mockResolvedValue("native-staking");
        run(
          baseInput,
          (states) => {
            try {
              expect(resolveSigningRouteMock).toHaveBeenCalledOnce();
              const routeArg = resolveSigningRouteMock.mock.calls[0]![0] as {
                input: { messageBytes: Uint8Array };
              };
              expect(routeArg.input).toEqual({ messageBytes: exampleTx });
              // TxCheck runs before the routing decision, exactly once.
              expect(provideTxCheckMock).toHaveBeenCalledOnce();
              expect(
                provideTxCheckMock.mock.invocationCallOrder[0]!,
              ).toBeLessThan(
                resolveSigningRouteMock.mock.invocationCallOrder[0]!,
              );
              expect(buildGenericMock).not.toHaveBeenCalled();
              expect(promptUiDisplayMock).not.toHaveBeenCalled();
              expect(inspectMock).toHaveBeenCalled();
              expect(signMock).toHaveBeenCalled();
              const steps = stepSequence(states);
              expect(steps).not.toContain(
                signTransactionDAStateSteps.BUILD_GENERIC_CLEAR_SIGN_CONTEXT,
              );
              const last = states[states.length - 1]!;
              expect(last.status).toBe(DeviceActionStatus.Completed);
              expect(
                last.status === DeviceActionStatus.Completed && last.output,
              ).toEqual(signature);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("rule match + delayed → basic terminal still refreshes the blockhash", () =>
      new Promise<void>((resolve, reject) => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
          }),
        );
        resolveSigningRouteMock.mockResolvedValue("native-staking");
        run(
          withRpcDelayed,
          (states) => {
            try {
              expect(buildGenericMock).not.toHaveBeenCalled();
              expect(stepSequence(states)).toEqual([
                signTransactionDAStateSteps.GET_APP_CONFIG,
                signTransactionDAStateSteps.INSPECT_TRANSACTION,
                signClearSignDAStateSteps.PREVIEW_TRANSACTION,
                signClearSignDAStateSteps.FETCH_BLOCKHASH,
                signClearSignDAStateSteps.DELAYED_SIGN,
              ]);
              expect(refreshBlockhashMock).toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("no rule match → generic path unchanged", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric();
        // buildGenericMock default → mode "none" → degraded → re-provision.
        run(
          baseInput,
          (states) => {
            try {
              expect(resolveSigningRouteMock).toHaveBeenCalledOnce();
              expect(buildGenericMock).toHaveBeenCalled();
              expect(provideTxCheckMock).toHaveBeenCalledTimes(2);
              expect(inspectMock).toHaveBeenCalled();
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it("routing actor failure → falls through to generic", () =>
      new Promise<void>((resolve, reject) => {
        withTxcAndGeneric();
        resolveSigningRouteMock.mockRejectedValue(new Error("boom"));
        run(
          baseInput,
          (states) => {
            try {
              expect(buildGenericMock).toHaveBeenCalled();
              expect(states[states.length - 1]!.status).toBe(
                DeviceActionStatus.Completed,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          reject,
        );
      }));

    it.each([
      ["app below the generic min version", () => undefined, baseInput],
      [
        "Nano S",
        () => {
          apiMock.getDeviceSessionState.mockReturnValue(
            session(
              SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION,
              DeviceModelId.NANO_S,
            ),
          );
          getAppConfigMock.mockResolvedValue(
            CommandResultFactory({
              data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
            }),
          );
        },
        baseInput,
      ],
      [
        "genericClearSign in disabledFeatures",
        () => {
          apiMock.getDeviceSessionState.mockReturnValue(
            session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
          );
          getAppConfigMock.mockResolvedValue(
            CommandResultFactory({
              data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
            }),
          );
        },
        {
          ...baseInput,
          disabledFeatures: ["genericClearSign"],
        } satisfies SignTransactionDAInput,
      ],
    ])(
      "generic unavailable (%s) → routing is not resolved",
      (_name, arrange, input) =>
        new Promise<void>((resolve, reject) => {
          arrange();
          run(
            input,
            (states) => {
              try {
                expect(resolveSigningRouteMock).not.toHaveBeenCalled();
                expect(buildGenericMock).not.toHaveBeenCalled();
                expect(signMock).toHaveBeenCalled();
                expect(states[states.length - 1]!.status).toBe(
                  DeviceActionStatus.Completed,
                );
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            reject,
          );
        }),
    );
  });

  describe("resolveSigningRoute dependency", () => {
    const resolveSigningRoute = (messageBytes: Uint8Array) =>
      new SignTransactionDeviceAction({ input: baseInput })
        .extractDependencies(apiMock)
        .resolveSigningRoute({ input: { messageBytes } });

    it("returns the native-staking rule for a Ledger Wallet unstake", async () => {
      await expect(resolveSigningRoute(UNSTAKE_MESSAGE)).resolves.toBe(
        "native-staking",
      );
    });

    it("returns null for a non-staking transaction", async () => {
      await expect(
        resolveSigningRoute(SEND_WITH_MEMO_MESSAGE),
      ).resolves.toBeNull();
    });

    it("returns null for an unparseable message", async () => {
      await expect(
        resolveSigningRoute(new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
      ).resolves.toBeNull();
    });

    it("matches a rule served by CAL and looks up the transaction's programs", async () => {
      const getContexts = vi.fn().mockResolvedValue([
        {
          type: ClearSignContextType.SOLANA_BASIC_FLOW_RULE,
          payload: {
            id: "send-with-memo",
            required: [
              { programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" },
            ],
            allowed: [{ programId: "11111111111111111111111111111111" }],
          },
        },
      ]);
      const contextModule = { getContexts } as unknown as ContextModule;

      await expect(
        new SignTransactionDeviceAction({
          input: { ...baseInput, contextModule },
        })
          .extractDependencies(apiMock)
          .resolveSigningRoute({
            input: { messageBytes: SEND_WITH_MEMO_MESSAGE },
          }),
      ).resolves.toBe("send-with-memo");
      expect(getContexts).toHaveBeenCalledWith(
        {
          programIds: expect.arrayContaining([
            "11111111111111111111111111111111",
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
          ]) as unknown,
        },
        [ClearSignContextType.SOLANA_BASIC_FLOW_RULE],
      );
    });
  });

  describe("message versions", () => {
    // Flex on the first generic clear-sign version, web3 checks opted in:
    // every child machine can run.
    beforeEach(() => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
            transactionChecksEnabled: true,
            transactionChecksOptIn: true,
          },
        }),
      );
    });

    const v0Message = Uint8Array.from([0x80, ...UNSTAKE_MESSAGE, 0]);

    // Tx-check, generic build (degraded by default here, as the parser does for
    // any message it cannot read), tx-check again, basic inspection (standard
    // transaction, so nothing to provide), report, then the one-shot sign.
    const fullPathSteps = [
      signTransactionDAStateSteps.GET_APP_CONFIG,
      signTransactionDAStateSteps.TRANSACTION_CHECKS_PROVIDE,
      signTransactionDAStateSteps.BUILD_GENERIC_CLEAR_SIGN_CONTEXT,
      signTransactionDAStateSteps.TRANSACTION_CHECKS_PROVIDE,
      signTransactionDAStateSteps.INSPECT_TRANSACTION,
      signTransactionDAStateSteps.SIGN_TRANSACTION,
    ];

    const expectFullPath = (
      states: DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[],
    ) => {
      expect(stepSequence(states)).toEqual(fullPathSteps);
      expect(provideTxCheckMock).toHaveBeenCalledTimes(2);
      expect(buildGenericMock).toHaveBeenCalledOnce();
      expect(inspectMock).toHaveBeenCalledOnce();
      expect(reportSignMock).toHaveBeenCalledOnce();
      expect(signMock).toHaveBeenCalledOnce();
      const last = states[states.length - 1]!;
      expect(
        last.status === DeviceActionStatus.Completed && last.output,
      ).toEqual(signature);
    };

    it.each([
      ["legacy", exampleTx],
      ["v0", v0Message],
    ])(
      "%s message: full signing path",
      (_, transaction) =>
        new Promise<void>((resolve, reject) => {
          run(
            { ...baseInput, transaction },
            (states) => {
              try {
                expectFullPath(states);
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            reject,
          );
        }),
    );

    // What the real normaliser hands on for input it cannot split.
    const passedThrough = (input: Uint8Array) =>
      new TransactionInputNormaliser().normalize(input).messageBytes;

    const expectRefusedAfterAppConfig = (
      states: DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[],
      expectedError: object,
    ) => {
      expect(stepSequence(states)).toEqual([
        signTransactionDAStateSteps.GET_APP_CONFIG,
      ]);
      expect(getAppConfigMock).toHaveBeenCalledOnce();
      for (const mock of [
        txCheckOptInMock,
        provideTxCheckMock,
        buildGenericMock,
        provideGenericMock,
        finalizeMock,
        promptUiDisplayMock,
        inspectMock,
        buildBasicMock,
        provideBasicMock,
        previewMock,
        refreshBlockhashMock,
        delayedSignMock,
        signMock,
        reportSignMock,
      ]) {
        expect(mock).not.toHaveBeenCalled();
      }
      const last = states[states.length - 1]!;
      expect(last.status).toBe(DeviceActionStatus.Error);
      expect(
        last.status === DeviceActionStatus.Error && last.error,
      ).toMatchObject(expectedError);
    };

    it.each([
      [
        "v1 on an app below the v1 version",
        SPEC_V1_MESSAGE,
        {
          _tag: "SolanaTransactionVersionNotSupportedError",
          version: 1,
          reason: "appVersion",
        },
      ],
      [
        "v1 wire input with a trailing byte",
        passedThrough(withTrailingBytes(SPEC_V1_MESSAGE, [0])),
        { _tag: "InvalidSolanaTransactionError", rule: "TRAILING_BYTES" },
      ],
      [
        "signature-prefixed input of an unknown version",
        passedThrough(withOneSignature(withByte(SPEC_V1_MESSAGE, 0, 0x82))),
        {
          _tag: "SolanaTransactionVersionNotSupportedError",
          version: 2,
          reason: "unknownVersion",
        },
      ],
    ])(
      "%s: refused right after the app configuration, nothing else sent",
      (_, transaction, expectedError) =>
        new Promise<void>((resolve, reject) => {
          run(
            { ...baseInput, transaction },
            (states) => {
              try {
                expectRefusedAfterAppConfig(states, expectedError);
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            reject,
          );
        }),
    );

    describe("on an app that supports v1", () => {
      beforeEach(() => {
        apiMock.getDeviceSessionState.mockReturnValue(
          session(SOLANA_MIN_V1_TRANSACTIONS_VERSION, DeviceModelId.FLEX),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              ...appConfig(SOLANA_MIN_V1_TRANSACTIONS_VERSION),
              transactionChecksEnabled: true,
              transactionChecksOptIn: true,
            },
          }),
        );
      });

      it("v1 message: full signing path", () =>
        new Promise<void>((resolve, reject) => {
          run(
            { ...baseInput, transaction: SPEC_V1_MESSAGE },
            (states) => {
              try {
                expectFullPath(states);
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            reject,
          );
        }));

      it("v1 message with v1Transactions disabled: refused as an app version", () =>
        new Promise<void>((resolve, reject) => {
          run(
            {
              ...baseInput,
              transaction: SPEC_V1_MESSAGE,
              disabledFeatures: ["v1Transactions"],
            },
            (states) => {
              try {
                expectRefusedAfterAppConfig(states, {
                  _tag: "SolanaTransactionVersionNotSupportedError",
                  version: 1,
                  reason: "appVersion",
                });
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            reject,
          );
        }));
    });
  });
});

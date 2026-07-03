import { type ContextModule } from "@ledgerhq/context-module";
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
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";
import {
  SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION,
  SOLANA_MIN_WEB3_CHECKS_VERSION,
} from "@internal/app-binder/SolanaApplicationResolver";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { ProvisionBasicClearSignDeviceAction } from "./ProvisionBasicClearSignDeviceAction";
import { ProvisionGenericClearSignDeviceAction } from "./ProvisionGenericClearSignDeviceAction";
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
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
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
let web3CheckOptInMock: ReturnType<typeof vi.fn>;
let provideWeb3CheckMock: ReturnType<typeof vi.fn>;

// Generic clear-sign (prepare) child deps
let buildGenericMock: ReturnType<typeof vi.fn>;
let provideGenericMock: ReturnType<typeof vi.fn>;
let finalizeMock: ReturnType<typeof vi.fn>;
// Basic clear-sign (provision) child deps
let inspectMock: ReturnType<typeof vi.fn>;
let buildBasicMock: ReturnType<typeof vi.fn>;
let provideBasicMock: ReturnType<typeof vi.fn>;
// Terminal sign-op deps (generic + basic) and the shared refresh task
let promptUiDisplayMock: ReturnType<typeof vi.fn>;
let previewMock: ReturnType<typeof vi.fn>;
let delayedSignMock: ReturnType<typeof vi.fn>;
let signMock: ReturnType<typeof vi.fn>;
let refreshBlockhashMock: ReturnType<typeof vi.fn>;
let zeroBlockhashMock: ReturnType<typeof vi.fn>;

let parentSpy: ReturnType<typeof vi.spyOn>;
let genericSpy: ReturnType<typeof vi.spyOn>;
let basicSpy: ReturnType<typeof vi.spyOn>;
let genericSignSpy: ReturnType<typeof vi.spyOn>;
let basicSignSpy: ReturnType<typeof vi.spyOn>;

function appConfig(version: string): AppConfiguration {
  return {
    blindSigningEnabled: true,
    pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
    version,
    web3ChecksEnabled: false,
    web3ChecksOptIn: false,
  };
}

function session(version: string, deviceModelId = DeviceModelId.NANO_X) {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: "Solana", version },
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
      zeroBlockhashFn: zeroBlockhashMock,
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
    getAppConfig: getAppConfigMock,
    web3CheckOptIn: web3CheckOptInMock,
    provideWeb3Check: provideWeb3CheckMock,
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
    web3CheckOptInMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: { enabled: true } }));
    provideWeb3CheckMock = vi.fn().mockResolvedValue(undefined);

    // Generic child: degrades by default (no instruction recognised).
    buildGenericMock = vi.fn().mockResolvedValue({
      mode: "none",
      poolContexts: [],
      instructionInfoContexts: [],
    });
    provideGenericMock = vi.fn().mockResolvedValue(undefined);
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
    buildBasicMock = vi.fn().mockResolvedValue({
      loadersResults: [],
      contextErrorCount: 0,
    });
    provideBasicMock = vi.fn().mockResolvedValue(undefined);

    // Terminal/delayed child: every path resolves to a signature.
    zeroBlockhashMock = vi.fn().mockResolvedValue(exampleTx);
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

    spyChildren();
  });

  afterEach(() => {
    parentSpy?.mockRestore();
    genericSpy.mockRestore();
    basicSpy.mockRestore();
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

  it("runs Web3Checks opt-in before clear-sign when the app requires it", () =>
    new Promise<void>((resolve, reject) => {
      // Flex on an app version that supports web3-checks; opt-in not yet done.
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_WEB3_CHECKS_VERSION, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(SOLANA_MIN_WEB3_CHECKS_VERSION),
            web3ChecksEnabled: false,
            web3ChecksOptIn: false,
          },
        }),
      );
      run(
        baseInput,
        (states) => {
          try {
            expect(web3CheckOptInMock).toHaveBeenCalled();
            // Opt-in must precede the terminal sign in the emitted sequence.
            const steps = stepSequence(states);
            const optInIdx = steps.indexOf(
              signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN,
            );
            const signIdx = steps.indexOf(
              signClearSignDAStateSteps.SIGN_TRANSACTION,
            );
            expect(optInIdx).toBeGreaterThanOrEqual(0);
            expect(signIdx).toBeGreaterThan(optInIdx);
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

  it("does not block signing when the web3-checks opt-in throws (best-effort)", () =>
    new Promise<void>((resolve, reject) => {
      // Flex on an app version that supports web3-checks; opt-in not yet done.
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_WEB3_CHECKS_VERSION, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(SOLANA_MIN_WEB3_CHECKS_VERSION),
            web3ChecksEnabled: false,
            web3ChecksOptIn: false,
          },
        }),
      );
      // The opt-in actor throws (not a CommandResult error): must proceed.
      web3CheckOptInMock.mockRejectedValue(new Error("opt-in transport error"));
      run(
        baseInput,
        (states) => {
          try {
            expect(web3CheckOptInMock).toHaveBeenCalled();
            // It still reaches the terminal sign and completes successfully.
            const steps = stepSequence(states);
            const optInIdx = steps.indexOf(
              signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN,
            );
            const signIdx = steps.indexOf(
              signClearSignDAStateSteps.SIGN_TRANSACTION,
            );
            expect(optInIdx).toBeGreaterThanOrEqual(0);
            expect(signIdx).toBeGreaterThan(optInIdx);
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

  it("provides web3-checks before the clear-sign branch, independent of the path taken", () =>
    new Promise<void>((resolve, reject) => {
      // Flex on a web3-supported version, already enabled (no opt-in needed).
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_WEB3_CHECKS_VERSION, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(SOLANA_MIN_WEB3_CHECKS_VERSION),
            web3ChecksEnabled: true,
            web3ChecksOptIn: true,
          },
        }),
      );
      run(
        baseInput,
        (states) => {
          try {
            expect(provideWeb3CheckMock).toHaveBeenCalled();
            const steps = stepSequence(states);
            const web3Idx = steps.indexOf(
              signTransactionDAStateSteps.WEB3_CHECKS_PROVIDE,
            );
            // It runs, and before any clear-sign / sign step.
            expect(web3Idx).toBeGreaterThanOrEqual(0);
            const signIdx = steps.indexOf(
              signClearSignDAStateSteps.SIGN_TRANSACTION,
            );
            expect(signIdx).toBeGreaterThan(web3Idx);
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
              signClearSignDAStateSteps.ZERO_BLOCKHASH,
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
});

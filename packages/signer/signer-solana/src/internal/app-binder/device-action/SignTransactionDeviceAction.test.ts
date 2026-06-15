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

import { signingOperationsDAStateSteps } from "@api/app-binder/SigningOperationsDeviceActionTypes";
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
import { SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION } from "@internal/app-binder/SolanaApplicationResolver";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { GenericClearSignDeviceAction } from "./GenericClearSignDeviceAction";
import { ShallowClearSignDeviceAction } from "./ShallowClearSignDeviceAction";
import { SigningOperationsDeviceAction } from "./SigningOperationsDeviceAction";
import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

/**
 * The parent is a thin orchestrator: setup (open app / config / web3 opt-in) →
 * gate → generic clear-sign machine and/or shallow clear-sign machine → the
 * (delayed) terminal-sign machine. These tests cover the orchestration only;
 * each child machine's behaviour is covered by its own test file.
 */

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const signature = new Uint8Array([0xaa, 0xbb]);
const armedSig = new Uint8Array([0x77, 0x88]);

// Below the generic-clear-sign min version → the gate routes to the shallow
// path; still supports spl / delayed / web3.
const legacyVersion = "1.15.5";

const contextModuleStub = {
  getContexts: vi.fn(),
} as unknown as ContextModule;

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getAppConfigMock: ReturnType<typeof vi.fn>;
let web3CheckOptInMock: ReturnType<typeof vi.fn>;

// Generic child deps
let buildGenericMock: ReturnType<typeof vi.fn>;
let provideGenericMock: ReturnType<typeof vi.fn>;
let promptUiDisplayMock: ReturnType<typeof vi.fn>;
// Shallow child deps
let inspectMock: ReturnType<typeof vi.fn>;
let shallowGetPubKeyMock: ReturnType<typeof vi.fn>;
let buildShallowMock: ReturnType<typeof vi.fn>;
let provideShallowMock: ReturnType<typeof vi.fn>;
// Delayed/terminal child deps
let previewMock: ReturnType<typeof vi.fn>;
let delayedSignMock: ReturnType<typeof vi.fn>;
let signMock: ReturnType<typeof vi.fn>;
let fetchBlockhashMock: ReturnType<typeof vi.fn>;
let zeroBlockhashMock: ReturnType<typeof vi.fn>;
let patchBlockhashMock: ReturnType<typeof vi.fn>;

let parentSpy: ReturnType<typeof vi.spyOn>;
let genericSpy: ReturnType<typeof vi.spyOn>;
let shallowSpy: ReturnType<typeof vi.spyOn>;
let delayedSpy: ReturnType<typeof vi.spyOn>;

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
    .spyOn(GenericClearSignDeviceAction.prototype, "extractDependencies")
    .mockReturnValue({
      buildGenericClearSignContext: buildGenericMock,
      provideGenericClearSignContext: provideGenericMock,
      promptUiDisplay: promptUiDisplayMock,
    } as any) as any;
  shallowSpy = vi
    .spyOn(ShallowClearSignDeviceAction.prototype, "extractDependencies")
    .mockReturnValue({
      inspectTransaction: inspectMock,
      getPubKey: shallowGetPubKeyMock,
      buildShallowClearSignContext: buildShallowMock,
      provideShallowClearSignContext: provideShallowMock,
    } as any) as any;
  delayedSpy = vi
    .spyOn(SigningOperationsDeviceAction.prototype, "extractDependencies")
    .mockReturnValue({
      previewTransaction: previewMock,
      delayedSignTransaction: delayedSignMock,
      signTransaction: signMock,
      fetchBlockhashFn: fetchBlockhashMock,
      zeroBlockhashFn: zeroBlockhashMock,
      patchBlockhashFn: patchBlockhashMock,
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

    // Generic child: degrades by default (no instruction recognised).
    buildGenericMock = vi.fn().mockResolvedValue({
      mode: "none",
      poolContexts: [],
      instructionInfoContexts: [],
    });
    provideGenericMock = vi.fn().mockResolvedValue(undefined);
    promptUiDisplayMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: undefined }));

    // Shallow child: provisions successfully by default.
    inspectMock = vi
      .fn()
      .mockResolvedValue({ transactionType: SolanaTransactionTypes.STANDARD });
    shallowGetPubKeyMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: "pk" }));
    buildShallowMock = vi.fn().mockResolvedValue({
      tlvDescriptor: new Uint8Array([1]),
      trustedNamePKICertificate: null,
      loadersResults: [],
      contextErrorCount: 0,
    });
    provideShallowMock = vi.fn().mockResolvedValue(Nothing);

    // Terminal/delayed child: every path resolves to a signature.
    zeroBlockhashMock = vi.fn().mockResolvedValue(exampleTx);
    previewMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: Nothing }));
    fetchBlockhashMock = vi
      .fn()
      .mockResolvedValue(new Uint8Array(32).fill(0xab));
    patchBlockhashMock = vi.fn().mockResolvedValue(exampleTx);
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
    shallowSpy.mockRestore();
    delayedSpy.mockRestore();
  });

  it("generic unavailable → shallow provisions → terminal one-shot sign (no RPC)", () =>
    new Promise<void>((resolve, reject) => {
      run(
        baseInput,
        (states) => {
          try {
            expect(buildGenericMock).not.toHaveBeenCalled();
            expect(inspectMock).toHaveBeenCalled();
            // No RPC → terminal one-shot (0x06), no delayed sign.
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

  it("generic available + armed → terminal delayed sign (alreadyArmed, refreshed)", () =>
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
        withRpc,
        (states) => {
          try {
            expect(buildGenericMock).toHaveBeenCalled();
            expect(promptUiDisplayMock).toHaveBeenCalled();
            // Armed → terminal refreshes blockhash and delayed-signs (no preview).
            expect(previewMock).not.toHaveBeenCalled();
            expect(fetchBlockhashMock).toHaveBeenCalled();
            expect(delayedSignMock).toHaveBeenCalled();
            // Shallow path not taken.
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

  it("generic degraded → shallow → terminal", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue(
        session(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: appConfig(SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION),
        }),
      );
      // buildGenericMock default → mode "none" → degraded.
      run(
        withRpc,
        (states) => {
          try {
            expect(buildGenericMock).toHaveBeenCalled();
            expect(inspectMock).toHaveBeenCalled(); // shallow ran
            // RPC present + not armed → terminal does the legacy delayed flow.
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

  it("generic user cancel (6985) → error, no shallow / no terminal", () =>
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

  it("terminal sign failure → error", () =>
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

  it("getAppConfig error → error", () =>
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
      // Flex supports web3-checks; opt-in not yet done.
      apiMock.getDeviceSessionState.mockReturnValue(
        session(legacyVersion, DeviceModelId.FLEX),
      );
      getAppConfigMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            ...appConfig(legacyVersion),
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
              signingOperationsDAStateSteps.SIGN_TRANSACTION,
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

  // End-to-end emitted-step-sequence contracts (the progression a consumer sees).
  it("e2e sequence: legacy SPL path with RPC → shallow provisioning then delayed terminal", () =>
    new Promise<void>((resolve, reject) => {
      inspectMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SPL,
        data: { tokenAddress: null, createATA: false },
      });
      run(
        withRpc,
        (states) => {
          try {
            expect(stepSequence(states)).toEqual([
              signTransactionDAStateSteps.GET_APP_CONFIG,
              signTransactionDAStateSteps.INSPECT_TRANSACTION,
              signTransactionDAStateSteps.GET_PUB_KEY,
              signTransactionDAStateSteps.BUILD_SHALLOW_CLEAR_SIGN_CONTEXT,
              signTransactionDAStateSteps.PROVIDE_SHALLOW_CLEAR_SIGN_CONTEXT,
              signingOperationsDAStateSteps.ZERO_BLOCKHASH,
              signingOperationsDAStateSteps.PREVIEW_TRANSACTION,
              signingOperationsDAStateSteps.FETCH_BLOCKHASH,
              signingOperationsDAStateSteps.PATCH_TRANSACTION,
              signingOperationsDAStateSteps.DELAYED_SIGN,
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

  it("e2e sequence: generic clear-sign armed → terminal refresh + delayed sign", () =>
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
        withRpc,
        (states) => {
          try {
            expect(stepSequence(states)).toEqual([
              signTransactionDAStateSteps.GET_APP_CONFIG,
              signTransactionDAStateSteps.BUILD_GENERIC_CLEAR_SIGN_CONTEXT,
              signTransactionDAStateSteps.PROVIDE_GENERIC_CLEAR_SIGN_CONTEXT,
              signTransactionDAStateSteps.PROMPT_UI_DISPLAY,
              signingOperationsDAStateSteps.FETCH_BLOCKHASH,
              signingOperationsDAStateSteps.PATCH_TRANSACTION,
              signingOperationsDAStateSteps.DELAYED_SIGN,
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

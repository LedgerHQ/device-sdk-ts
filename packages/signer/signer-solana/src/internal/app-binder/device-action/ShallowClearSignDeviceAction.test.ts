import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import {
  type ShallowClearSignDAError,
  type ShallowClearSignDAInput,
  type ShallowClearSignDAIntermediateValue,
  ShallowClearSignDeviceAction,
} from "./ShallowClearSignDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

const appConfig: AppConfiguration = {
  blindSigningEnabled: true,
  pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
  version: "1.10.0",
  web3ChecksEnabled: false,
  web3ChecksOptIn: false,
};

const contextModuleStub = { getContexts: vi.fn() } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const shallowContext = {
  tlvDescriptor: new Uint8Array([1]),
  trustedNamePKICertificate: {
    keyUsageNumber: 0,
    payload: new Uint8Array([1]),
  },
  loadersResults: [],
  contextErrorCount: 0,
};

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let inspectMock: ReturnType<typeof vi.fn>;
let getPubKeyMock: ReturnType<typeof vi.fn>;
let buildMock: ReturnType<typeof vi.fn>;
let provideMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    inspectTransaction: inspectMock,
    getPubKey: getPubKeyMock,
    buildShallowClearSignContext: buildMock,
    provideShallowClearSignContext: provideMock,
  };
}

function run(
  input: ShallowClearSignDAInput,
  onComplete: (
    states: DeviceActionState<
      void,
      ShallowClearSignDAError,
      ShallowClearSignDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new ShallowClearSignDeviceAction({ input });
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    void,
    ShallowClearSignDAError,
    ShallowClearSignDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

const splInput: ShallowClearSignDAInput = {
  derivationPath: defaultDerivation,
  transaction: exampleTx,
  contextModule: contextModuleStub,
  appConfig,
};

describe("ShallowClearSignDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.10.0" },
      deviceModelId: DeviceModelId.NANO_X,
      isSecureConnectionAllowed: true,
    });
    inspectMock = vi.fn().mockResolvedValue({
      transactionType: SolanaTransactionTypes.SPL,
      data: { tokenAddress: null, createATA: false },
    });
    getPubKeyMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: "pk" }));
    buildMock = vi.fn().mockResolvedValue(shallowContext);
    provideMock = vi.fn().mockResolvedValue(Nothing);
  });

  it("SPL tx: inspect → getPubKey → build → provide → done", () =>
    new Promise<void>((resolve, reject) => {
      run(
        splInput,
        (states) => {
          try {
            expect(inspectMock).toHaveBeenCalled();
            expect(getPubKeyMock).toHaveBeenCalled();
            expect(buildMock).toHaveBeenCalled();
            expect(provideMock).toHaveBeenCalled();
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

  it("SWAP tx: builds context like SPL", () =>
    new Promise<void>((resolve, reject) => {
      inspectMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.SWAP,
        data: { tokenAddress: null, createATA: false },
      });
      run(
        splInput,
        (states) => {
          try {
            expect(inspectMock).toHaveBeenCalled();
            expect(getPubKeyMock).toHaveBeenCalled();
            expect(buildMock).toHaveBeenCalled();
            expect(provideMock).toHaveBeenCalled();
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

  it("inspect rejects → completes without building (blind fallback)", () =>
    new Promise<void>((resolve, reject) => {
      inspectMock.mockRejectedValue(new InvalidStatusWordError("insp"));
      run(
        splInput,
        (states) => {
          try {
            expect(buildMock).not.toHaveBeenCalled();
            expect(provideMock).not.toHaveBeenCalled();
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

  it("non-SPL standard tx with web3 unsupported (Nano X): skips build entirely", () =>
    new Promise<void>((resolve, reject) => {
      inspectMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.STANDARD,
      });
      run(
        splInput,
        (states) => {
          try {
            // SPL supported → inspect runs, but STANDARD + no web3 → no build.
            expect(inspectMock).toHaveBeenCalled();
            expect(getPubKeyMock).not.toHaveBeenCalled();
            expect(buildMock).not.toHaveBeenCalled();
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

  it("non-SPL standard tx but web3-checks supported (Flex): still builds context", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.15.0" },
        deviceModelId: DeviceModelId.FLEX,
        isSecureConnectionAllowed: true,
      });
      inspectMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.STANDARD,
      });
      run(
        // web3-checks needs both a supported model (Flex) and app version ≥ 1.15.
        { ...splInput, appConfig: { ...appConfig, version: "1.15.0" } },
        (states) => {
          try {
            // STANDARD → shouldBuildContext false, but web3 supported → build.
            expect(inspectMock).toHaveBeenCalled();
            expect(getPubKeyMock).toHaveBeenCalled();
            expect(buildMock).toHaveBeenCalled();
            expect(provideMock).toHaveBeenCalled();
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

  it("SPL unsupported (Nano S): skips inspect and completes", () =>
    new Promise<void>((resolve, reject) => {
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Solana", version: "1.10.0" },
        deviceModelId: DeviceModelId.NANO_S,
        isSecureConnectionAllowed: true,
      });
      run(
        splInput,
        (states) => {
          try {
            expect(inspectMock).not.toHaveBeenCalled();
            expect(buildMock).not.toHaveBeenCalled();
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

  it("build throws → completes without providing", () =>
    new Promise<void>((resolve, reject) => {
      buildMock.mockRejectedValue(new Error("build boom"));
      run(
        splInput,
        (states) => {
          try {
            expect(buildMock).toHaveBeenCalled();
            expect(provideMock).not.toHaveBeenCalled();
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

  it("provide rejects → still completes (blind fallback)", () =>
    new Promise<void>((resolve, reject) => {
      provideMock.mockRejectedValue(new Error("provide boom"));
      run(
        splInput,
        (states) => {
          try {
            expect(provideMock).toHaveBeenCalled();
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

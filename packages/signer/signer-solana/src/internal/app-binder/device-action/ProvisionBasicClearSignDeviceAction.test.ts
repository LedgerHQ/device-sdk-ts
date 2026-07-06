import {
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ProvisionBasicClearSignDAError,
  type ProvisionBasicClearSignDAInput,
  type ProvisionBasicClearSignDAIntermediateValue,
} from "@api/app-binder/ProvisionBasicClearSignDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";
import { SolanaTransactionTypes } from "@internal/app-binder/services/TransactionInspector";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { ProvisionBasicClearSignDeviceAction } from "./ProvisionBasicClearSignDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

const appConfig: AppConfiguration = {
  blindSigningEnabled: true,
  pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
  version: "1.10.0",
  transactionChecksEnabled: false,
  transactionChecksOptIn: false,
};

const contextModuleStub = { getContexts: vi.fn() } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const basicContext = {
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
let buildMock: ReturnType<typeof vi.fn>;
let provideMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    inspectTransaction: inspectMock,
    buildBasicClearSignContext: buildMock,
    provideBasicClearSignContext: provideMock,
  };
}

function run(
  input: ProvisionBasicClearSignDAInput,
  onComplete: (
    states: DeviceActionState<
      void,
      ProvisionBasicClearSignDAError,
      ProvisionBasicClearSignDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new ProvisionBasicClearSignDeviceAction({ input });
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    void,
    ProvisionBasicClearSignDAError,
    ProvisionBasicClearSignDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

const splInput: ProvisionBasicClearSignDAInput = {
  derivationPath: defaultDerivation,
  transaction: exampleTx,
  contextModule: contextModuleStub,
  appConfig,
};

describe("ProvisionBasicClearSignDeviceAction", () => {
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
    buildMock = vi.fn().mockResolvedValue(basicContext);
    provideMock = vi.fn().mockResolvedValue(undefined);
  });

  it("SPL tx: inspect then build then provide then done", () =>
    new Promise<void>((resolve, reject) => {
      run(
        splInput,
        (states) => {
          try {
            expect(inspectMock).toHaveBeenCalled();
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

  it("inspect rejects then completes without building (blind fallback)", () =>
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

  it("non-SPL standard tx with txCheck unsupported (Nano X): skips build entirely", () =>
    new Promise<void>((resolve, reject) => {
      inspectMock.mockResolvedValue({
        transactionType: SolanaTransactionTypes.STANDARD,
      });
      run(
        splInput,
        (states) => {
          try {
            // SPL supported so inspect runs, but STANDARD means no build.
            expect(inspectMock).toHaveBeenCalled();
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

  it("build throws then completes without providing", () =>
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

  it("provide rejects then still completes (blind fallback)", () =>
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
